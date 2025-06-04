/* eslint-disable complexity */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-console */
/**
 * Alert Service - Handles equipment alerts, notifications, and monitoring
 */

import { EventEmitter } from 'events';
import type {
  EquipmentAlert,
  AlertType,
  EquipmentId,
  Position,
  Timestamp,
  Geofence,
  GeofenceType,
  CircularGeofence,
  RectangularGeofence,
} from '../types/index.js';
import type { IEquipmentService } from './equipment.service.js';
import { isPointInCircle, isPointInBounds } from '../infrastructure/utils/distance-calculator.js';

export interface IAlertService {
  // Alert management
  createAlert(
    alert: Omit<EquipmentAlert, 'id' | 'timestamp' | 'acknowledged'>,
  ): Promise<EquipmentAlert>;
  getAlerts(equipmentId?: EquipmentId): Promise<EquipmentAlert[]>;
  acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<EquipmentAlert>;
  getUnacknowledgedAlerts(): Promise<EquipmentAlert[]>;

  // Geofence management
  addGeofence(geofence: Omit<Geofence, 'id' | 'createdAt' | 'updatedAt'>): Promise<Geofence>;
  removeGeofence(geofenceId: string): Promise<void>;
  getGeofences(): Promise<Geofence[]>;
  checkGeofenceViolations(equipmentId: EquipmentId, position: Position): Promise<void>;

  // Monitoring rules
  addMonitoringRule(rule: {
    id: string;
    name: string;
    equipmentId?: EquipmentId;
    conditions: {
      maxInactiveTime?: number; // milliseconds
      maxSpeed?: number; // m/s
      minAccuracy?: number; // meters
      operatingHours?: { start: string; end: string }; // HH:MM format
      geofenceIds?: string[];
    };
    alertType: AlertType;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void>;

  removeMonitoringRule(ruleId: string): Promise<void>;
  checkMonitoringRules(equipmentId: EquipmentId, position: Position): Promise<void>;

  // Event handlers
  onAlert(callback: (alert: EquipmentAlert) => void): void;
  onGeofenceViolation(
    callback: (equipmentId: EquipmentId, geofenceId: string, position: Position) => void,
  ): void;

  // Statistics
  getAlertStatistics(): Promise<{
    totalAlerts: number;
    unacknowledgedAlerts: number;
    alertsByType: Record<AlertType, number>;
    alertsBySeverity: Record<string, number>;
    recentAlerts: EquipmentAlert[];
  }>;
}

interface MonitoringRule {
  id: string;
  name: string;
  equipmentId?: EquipmentId;
  conditions: {
    maxInactiveTime?: number;
    maxSpeed?: number;
    minAccuracy?: number;
    operatingHours?: { start: string; end: string };
    geofenceIds?: string[];
  };
  alertType: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Timestamp;
  enabled: boolean;
}

export class AlertService extends EventEmitter implements IAlertService {
  private alerts = new Map<string, EquipmentAlert>();
  private geofences = new Map<string, Geofence>();
  private monitoringRules = new Map<string, MonitoringRule>();
  private lastPositions = new Map<EquipmentId, { position: Position; timestamp: Timestamp }>();
  private alertIdCounter = 1;
  private geofenceIdCounter = 1;

  constructor(private equipmentService: IEquipmentService) {
    super();
    this.initializeService();
  }

  private initializeService(): void {
    console.log('[AlertService] Initializing alert service');

    // Add default monitoring rules
    this.addDefaultMonitoringRules();

    // Start periodic monitoring
    this.startPeriodicMonitoring();
  }

  async createAlert(
    alertData: Omit<EquipmentAlert, 'id' | 'timestamp' | 'acknowledged'>,
  ): Promise<EquipmentAlert> {
    const alert: EquipmentAlert = {
      ...alertData,
      id: `alert_${this.alertIdCounter++}`,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.alerts.set(alert.id, alert);

    // Emit alert event
    this.emit('alert', alert);

    console.log(
      `[AlertService] Created ${alert.severity} alert for equipment ${alert.equipmentId}: ${alert.message}`,
    );

    return alert;
  }

  async getAlerts(equipmentId?: EquipmentId): Promise<EquipmentAlert[]> {
    const allAlerts = Array.from(this.alerts.values());

    if (equipmentId) {
      return allAlerts.filter(alert => alert.equipmentId === equipmentId);
    }

    return allAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<EquipmentAlert> {
    const alert = this.alerts.get(alertId);

    if (!alert) {
      throw new Error(`Alert with ID ${alertId} not found`);
    }

    if (alert.acknowledged) {
      throw new Error(`Alert ${alertId} is already acknowledged`);
    }

    const updatedAlert: EquipmentAlert = {
      ...alert,
      acknowledged: true,
      acknowledgedBy,
      acknowledgedAt: new Date(),
    };

    this.alerts.set(alertId, updatedAlert);

    console.log(`[AlertService] Alert ${alertId} acknowledged by ${acknowledgedBy}`);

    return updatedAlert;
  }

  async getUnacknowledgedAlerts(): Promise<EquipmentAlert[]> {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async addGeofence(
    geofenceData: Omit<Geofence, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Geofence> {
    const geofence: Geofence = {
      ...geofenceData,
      id: `geofence_${this.geofenceIdCounter++}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Geofence;

    this.geofences.set(geofence.id, geofence);

    console.log(`[AlertService] Added ${geofence.type} geofence: ${geofence.name}`);

    return geofence;
  }

  async removeGeofence(geofenceId: string): Promise<void> {
    const deleted = this.geofences.delete(geofenceId);

    if (!deleted) {
      throw new Error(`Geofence with ID ${geofenceId} not found`);
    }

    console.log(`[AlertService] Removed geofence: ${geofenceId}`);
  }

  async getGeofences(): Promise<Geofence[]> {
    return Array.from(this.geofences.values());
  }

  async checkGeofenceViolations(equipmentId: EquipmentId, position: Position): Promise<void> {
    try {
      const lastPositionData = this.lastPositions.get(equipmentId);
      const geofences = Array.from(this.geofences.values()).filter(gf => gf.active);

      for (const geofence of geofences) {
        const currentlyInside = this.isPositionInGeofence(position, geofence);
        const wasInside = lastPositionData
          ? this.isPositionInGeofence(lastPositionData.position, geofence)
          : false;

        // Check for entry violation
        if (currentlyInside && !wasInside) {
          await this.createAlert({
            equipmentId,
            type: 'geofence_violation' as AlertType,
            severity: 'medium',
            message: `Equipment entered geofence: ${geofence.name}`,
            metadata: {
              geofenceId: geofence.id,
              geofenceName: geofence.name,
              violationType: 'entered',
              position: {
                latitude: position.latitude,
                longitude: position.longitude,
              },
            },
          });

          this.emit('geofenceViolation', equipmentId, geofence.id, position);
        }

        // Check for exit violation
        if (!currentlyInside && wasInside) {
          await this.createAlert({
            equipmentId,
            type: 'geofence_violation' as AlertType,
            severity: 'medium',
            message: `Equipment exited geofence: ${geofence.name}`,
            metadata: {
              geofenceId: geofence.id,
              geofenceName: geofence.name,
              violationType: 'exited',
              position: {
                latitude: position.latitude,
                longitude: position.longitude,
              },
            },
          });

          this.emit('geofenceViolation', equipmentId, geofence.id, position);
        }
      }

      // Update last position
      this.lastPositions.set(equipmentId, { position, timestamp: new Date() });
    } catch (error) {
      console.error(
        `[AlertService] Failed to check geofence violations for equipment ${equipmentId}:`,
        error,
      );
    }
  }

  async addMonitoringRule(ruleData: {
    id: string;
    name: string;
    equipmentId?: EquipmentId;
    conditions: {
      maxInactiveTime?: number;
      maxSpeed?: number;
      minAccuracy?: number;
      operatingHours?: { start: string; end: string };
      geofenceIds?: string[];
    };
    alertType: AlertType;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void> {
    const rule: MonitoringRule = {
      ...ruleData,
      createdAt: new Date(),
      enabled: true,
    };

    this.monitoringRules.set(rule.id, rule);

    console.log(`[AlertService] Added monitoring rule: ${rule.name}`);
  }

  async removeMonitoringRule(ruleId: string): Promise<void> {
    const deleted = this.monitoringRules.delete(ruleId);

    if (!deleted) {
      throw new Error(`Monitoring rule with ID ${ruleId} not found`);
    }

    console.log(`[AlertService] Removed monitoring rule: ${ruleId}`);
  }

  async checkMonitoringRules(equipmentId: EquipmentId, position: Position): Promise<void> {
    try {
      const rules = Array.from(this.monitoringRules.values()).filter(
        rule => rule.enabled && (!rule.equipmentId || rule.equipmentId === equipmentId),
      );

      for (const rule of rules) {
        await this.evaluateRule(rule, equipmentId, position);
      }
    } catch (error) {
      console.error(
        `[AlertService] Failed to check monitoring rules for equipment ${equipmentId}:`,
        error,
      );
    }
  }

  onAlert(callback: (alert: EquipmentAlert) => void): void {
    this.on('alert', callback);
  }

  onGeofenceViolation(
    callback: (equipmentId: EquipmentId, geofenceId: string, position: Position) => void,
  ): void {
    this.on('geofenceViolation', callback);
  }

  async getAlertStatistics(): Promise<{
    totalAlerts: number;
    unacknowledgedAlerts: number;
    alertsByType: Record<AlertType, number>;
    alertsBySeverity: Record<string, number>;
    recentAlerts: EquipmentAlert[];
  }> {
    const allAlerts = Array.from(this.alerts.values());
    const unacknowledgedAlerts = allAlerts.filter(alert => !alert.acknowledged);

    // Group by type
    const alertsByType: Record<string, number> = {};
    const alertsBySeverity: Record<string, number> = {};

    for (const alert of allAlerts) {
      alertsByType[alert.type] = (alertsByType[alert.type] ?? 0) + 1;
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] ?? 0) + 1;
    }

    // Get recent alerts (last 10)
    const recentAlerts = allAlerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      totalAlerts: allAlerts.length,
      unacknowledgedAlerts: unacknowledgedAlerts.length,
      alertsByType: alertsByType as Record<AlertType, number>,
      alertsBySeverity,
      recentAlerts,
    };
  }

  // Private helper methods
  private isPositionInGeofence(position: Position, geofence: Geofence): boolean {
    switch (geofence.type) {
      case 'circle' as GeofenceType: {
        const circularGeofence = geofence as CircularGeofence;
        return isPointInCircle(
          position.latitude,
          position.longitude,
          circularGeofence.center.latitude,
          circularGeofence.center.longitude,
          circularGeofence.radius,
        );
      }

      case 'rectangle' as GeofenceType: {
        const rectangularGeofence = geofence as RectangularGeofence;
        return isPointInBounds(
          position.latitude,
          position.longitude,
          rectangularGeofence.bounds.northEast.lat,
          rectangularGeofence.bounds.northEast.lng,
          rectangularGeofence.bounds.southWest.lat,
          rectangularGeofence.bounds.southWest.lng,
        );
      }

      case 'polygon' as GeofenceType: {
        // Simplified polygon check - in a real implementation, use ray casting algorithm
        return false; // TODO: Implement polygon geofence checking
      }

      default:
        return false;
    }
  }

  private async evaluateRule(
    rule: MonitoringRule,
    equipmentId: EquipmentId,
    position: Position,
  ): Promise<void> {
    const conditions = rule.conditions;

    // Check speed limit
    if (conditions.maxSpeed !== undefined) {
      // Calculate speed from last position (simplified)
      const lastPositionData = this.lastPositions.get(equipmentId);
      if (lastPositionData) {
        const timeDiff =
          (position.timestamp.getTime() - lastPositionData.timestamp.getTime()) / 1000;
        if (timeDiff > 0) {
          const distance =
            position.latitude !== lastPositionData.position.latitude ||
            position.longitude !== lastPositionData.position.longitude
              ? 100
              : 0; // Simplified distance calculation
          const speed = distance / timeDiff;

          if (speed > conditions.maxSpeed) {
            await this.createAlert({
              equipmentId,
              type: rule.alertType,
              severity: rule.severity,
              message: `Equipment exceeded speed limit: ${speed.toFixed(1)} m/s (limit: ${conditions.maxSpeed} m/s)`,
              metadata: {
                ruleId: rule.id,
                ruleName: rule.name,
                actualSpeed: speed,
                speedLimit: conditions.maxSpeed,
              },
            });
          }
        }
      }
    }

    // Check accuracy
    if (conditions.minAccuracy !== undefined && position.accuracy > conditions.minAccuracy) {
      await this.createAlert({
        equipmentId,
        type: rule.alertType,
        severity: rule.severity,
        message: `GPS accuracy is poor: ${position.accuracy.toFixed(1)}m (required: <${conditions.minAccuracy}m)`,
        metadata: {
          ruleId: rule.id,
          ruleName: rule.name,
          actualAccuracy: position.accuracy,
          requiredAccuracy: conditions.minAccuracy,
        },
      });
    }

    // Check operating hours
    if (conditions.operatingHours) {
      const currentHour = position.timestamp.getHours();
      const currentMinute = position.timestamp.getMinutes();
      const currentTime = currentHour * 60 + currentMinute; // minutes since midnight

      const startTimeParts = conditions.operatingHours.start.split(':').map(Number);
      const endTimeParts = conditions.operatingHours.end.split(':').map(Number);

      if (
        startTimeParts.length < 2 ||
        endTimeParts.length < 2 ||
        startTimeParts[0] === undefined ||
        startTimeParts[1] === undefined ||
        endTimeParts[0] === undefined ||
        endTimeParts[1] === undefined ||
        Number.isNaN(startTimeParts[0]) ||
        Number.isNaN(startTimeParts[1]) ||
        Number.isNaN(endTimeParts[0]) ||
        Number.isNaN(endTimeParts[1])
      ) {
        console.error(
          `[AlertService] Invalid time format in operating hours rule: ${JSON.stringify(conditions.operatingHours)}`,
        );
        return;
      }

      const startTime = startTimeParts[0] * 60 + startTimeParts[1];
      const endTime = endTimeParts[0] * 60 + endTimeParts[1];

      if (currentTime < startTime || currentTime > endTime) {
        await this.createAlert({
          equipmentId,
          type: rule.alertType,
          severity: rule.severity,
          message: `Equipment active outside operating hours (${conditions.operatingHours.start} - ${conditions.operatingHours.end})`,
          metadata: {
            ruleId: rule.id,
            ruleName: rule.name,
            operatingHours: conditions.operatingHours,
            actualTime: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`,
          },
        });
      }
    }
  }

  private addDefaultMonitoringRules(): void {
    // Add some default monitoring rules
    void this.addMonitoringRule({
      id: 'default_speed_limit',
      name: 'General Speed Limit',
      conditions: { maxSpeed: 25 }, // 25 m/s = 90 km/h
      alertType: 'speed_limit' as AlertType,
      severity: 'high',
    });

    void this.addMonitoringRule({
      id: 'default_accuracy',
      name: 'GPS Accuracy Monitor',
      conditions: { minAccuracy: 10 }, // 10 meters
      alertType: 'connection_lost' as AlertType, // Using closest available type
      severity: 'medium',
    });
  }

  private startPeriodicMonitoring(): void {
    // Check for inactive equipment every 5 minutes
    setInterval(
      () => {
        void this.checkInactiveEquipment();
      },
      5 * 60 * 1000,
    );
  }

  private async checkInactiveEquipment(): Promise<void> {
    try {
      const now = new Date();
      const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

      for (const [equipmentId, positionData] of this.lastPositions.entries()) {
        const inactiveTime = now.getTime() - positionData.timestamp.getTime();

        if (inactiveTime > inactiveThreshold) {
          await this.createAlert({
            equipmentId,
            type: 'connection_lost' as AlertType,
            severity: 'medium',
            message: `Equipment has been inactive for ${Math.round(inactiveTime / (60 * 1000))} minutes`,
            metadata: {
              inactiveTimeMs: inactiveTime,
              lastSeenAt: positionData.timestamp.toISOString(),
            },
          });
        }
      }
    } catch (error) {
      console.error('[AlertService] Failed to check inactive equipment:', error);
    }
  }
}

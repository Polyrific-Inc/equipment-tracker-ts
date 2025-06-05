/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-console */
/**
 * Application Service - Orchestrates all services and handles application lifecycle
 */

import type { EquipmentId, Position, CreatePositionData, PositionSource } from '../types/index.js';
import { EquipmentRepository } from '../repositories/equipment.repository.js';
import { PositionRepository } from '../repositories/position.repository.js';
import { EquipmentService } from './equipment.service.js';
import { GpsTrackingService } from './gps-tracking.service.js';
import { AlertService } from './alert.service.js';

export interface IAppService {
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // Service access
  getEquipmentService(): EquipmentService;
  getGpsTrackingService(): GpsTrackingService;
  getAlertService(): AlertService;

  // Quick access methods for common operations
  processPositionUpdate(
    equipmentId: EquipmentId,
    position: CreatePositionData,
    source?: PositionSource,
  ): Promise<void>;
  startEquipmentTracking(equipmentId: EquipmentId): Promise<void>;
  stopEquipmentTracking(equipmentId: EquipmentId): Promise<void>;
  startDemoSimulation(): Promise<void>;
  stopAllSimulations(): Promise<void>;
  getApplicationStatistics(): Promise<{
    equipment: any;
    tracking: any;
    alerts: any;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
  }>;

  // Health check
  getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      equipment: boolean;
      gpsTracking: boolean;
      alerts: boolean;
      repositories: boolean;
    };
    uptime: number;
    version: string;
  }>;
}

export class AppService implements IAppService {
  private equipmentRepository: EquipmentRepository;
  private positionRepository: PositionRepository;
  private equipmentService: EquipmentService;
  private gpsTrackingService: GpsTrackingService;
  private alertService: AlertService;
  private startTime: Date;
  private initialized = false;

  constructor() {
    this.startTime = new Date();

    // Initialize repositories
    this.equipmentRepository = new EquipmentRepository();
    this.positionRepository = new PositionRepository();

    // Initialize services with dependency injection
    this.equipmentService = new EquipmentService(this.equipmentRepository, this.positionRepository);
    this.gpsTrackingService = new GpsTrackingService(
      this.positionRepository,
      this.equipmentService,
    );
    this.alertService = new AlertService(this.equipmentService);
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[AppService] Already initialized');
      return;
    }

    try {
      console.log('[AppService] Initializing application services...');

      // Initialize service integrations
      await this.setupServiceIntegrations();

      // Setup sample geofences for demo
      await this.setupSampleGeofences();

      this.initialized = true;
      console.log('[AppService] Application services initialized successfully');
    } catch (error) {
      console.error('[AppService] Failed to initialize:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      console.log('[AppService] Shutting down application services...');

      // Stop all equipment tracking
      const equipment = await this.equipmentService.getAllEquipment({ page: 1, limit: 1000 });
      if (equipment?.data) {
        for (const eq of equipment.data) {
          if (this.gpsTrackingService.isTracking(eq.id)) {
            await this.gpsTrackingService.stopTracking(eq.id);
          }
        }
      }

      this.initialized = false;
      console.log('[AppService] Application services shut down successfully');
    } catch (error) {
      console.error('[AppService] Error during shutdown:', error);
      throw error;
    }
  }

  getEquipmentService(): EquipmentService {
    return this.equipmentService;
  }

  getGpsTrackingService(): GpsTrackingService {
    return this.gpsTrackingService;
  }

  getAlertService(): AlertService {
    return this.alertService;
  }

  async processPositionUpdate(
    equipmentId: EquipmentId,
    position: CreatePositionData,
    source?: PositionSource,
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('AppService not initialized');
    }

    try {
      // Process position through GPS tracking service
      await this.gpsTrackingService.processPositionUpdate(equipmentId, position, source);

      // Check for geofence violations
      const positionObj: Position = {
        latitude: position.latitude,
        longitude: position.longitude,
        altitude: position.altitude ?? 0,
        accuracy: position.accuracy ?? 2.5,
        timestamp: position.timestamp ?? new Date(),
        distanceTo(lastPosition: Position): number {
          // Haversine formula to calculate distance between two points
          const R = 6371e3; // Earth radius in meters
          const φ1 = (this.latitude * Math.PI) / 180;
          const φ2 = (lastPosition.latitude * Math.PI) / 180;
          const Δφ = ((lastPosition.latitude - this.latitude) * Math.PI) / 180;
          const Δλ = ((lastPosition.longitude - this.longitude) * Math.PI) / 180;

          const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

          return R * c; // distance in meters
        },
      };

      await this.alertService.checkGeofenceViolations(equipmentId, positionObj);
      await this.alertService.checkMonitoringRules(equipmentId, positionObj);
    } catch (error) {
      console.error(
        `[AppService] Failed to process position update for equipment ${equipmentId}:`,
        error,
      );
      throw error;
    }
  }

  async startEquipmentTracking(equipmentId: EquipmentId): Promise<void> {
    if (!this.initialized) {
      throw new Error('AppService not initialized');
    }

    await this.gpsTrackingService.startTracking(equipmentId);
    console.log(`[AppService] Started tracking equipment: ${equipmentId}`);
  }

  async stopEquipmentTracking(equipmentId: EquipmentId): Promise<void> {
    if (!this.initialized) {
      throw new Error('AppService not initialized');
    }

    await this.gpsTrackingService.stopTracking(equipmentId);
    console.log(`[AppService] Stopped tracking equipment: ${equipmentId}`);
  }

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      equipment: boolean;
      gpsTracking: boolean;
      alerts: boolean;
      repositories: boolean;
    };
    uptime: number;
    version: string;
  }> {
    const uptime = Date.now() - this.startTime.getTime();

    // Check service health
    const services = {
      equipment: this.initialized,
      gpsTracking: this.initialized,
      alerts: this.initialized,
      repositories: this.initialized,
    };

    // Determine overall status
    const healthyServices = Object.values(services).filter(Boolean).length;
    const totalServices = Object.values(services).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === totalServices) {
      status = 'healthy';
    } else if (healthyServices > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      services,
      uptime,
      version: '1.0.0',
    };
  }

  // Private helper methods
  private async setupServiceIntegrations(): Promise<void> {
    // Connect GPS tracking service events to alert service
    this.gpsTrackingService.onPositionUpdate(
      (equipmentId: EquipmentId, position: Position): void => {
        try {
          // Don't return the promise, just execute it
          void this.alertService
            .checkGeofenceViolations(equipmentId, position)
            .then(() => {
              void this.alertService.checkMonitoringRules(equipmentId, position);
            })
            .catch(error => {
              console.error(
                `[AppService] Error processing position update events for ${equipmentId}:`,
                error,
              );
            });
        } catch (error) {
          console.error(
            `[AppService] Error processing position update events for ${equipmentId}:`,
            error,
          );
        }
      },
    );

    // Connect movement detection to alerts
    this.gpsTrackingService.onMovementDetected((equipmentId: EquipmentId, speed: number) => {
      console.log(
        `[AppService] Movement detected for equipment ${equipmentId}: ${speed.toFixed(2)} m/s`,
      );
    });

    // Connect geofence violations
    this.gpsTrackingService.onGeofenceViolation(
      (equipmentId: EquipmentId, position: Position, geofenceId: string) => {
        console.log(
          `[AppService] Geofence violation detected for equipment ${equipmentId} at geofence ${geofenceId}`,
        );
      },
    );

    // Connect alert events
    this.alertService.onAlert(alert => {
      console.log(
        `[AppService] Alert created: [${alert.severity.toUpperCase()}] ${alert.message} (Equipment: ${alert.equipmentId})`,
      );
    });

    this.alertService.onGeofenceViolation((equipmentId, geofenceId) => {
      console.log(
        `[AppService] Geofence violation: Equipment ${equipmentId} at geofence ${geofenceId}`,
      );
    });

    console.log('[AppService] Service integrations configured');
  }

  private async setupSampleGeofences(): Promise<void> {
    try {
      // Add a sample circular geofence (warehouse area)
      await this.alertService.addGeofence({
        name: 'Main Warehouse',
        type: 'circle',
        active: true,
        center: {
          latitude: 37.7749,
          longitude: -122.4194,
        },
        radius: 500, // 500 meters
      } as any);

      // Add a sample rectangular geofence (construction site)
      await this.alertService.addGeofence({
        name: 'Construction Site A',
        type: 'rectangle',
        active: true,
        bounds: {
          northEast: { lat: 37.785, lng: -122.4094 },
          southWest: { lat: 37.78, lng: -122.4144 },
        },
      } as any);

      console.log('[AppService] Sample geofences created');
    } catch (error) {
      console.error('[AppService] Failed to setup sample geofences:', error);
    }
  }

  /**
   * Start a demo simulation with sample equipment movement
   */
  async startDemoSimulation(): Promise<void> {
    if (!this.initialized) {
      throw new Error('AppService not initialized');
    }

    try {
      console.log('[AppService] Starting demo simulation...');

      // Get active equipment
      const activeEquipment = await this.equipmentService.getActiveEquipment({
        page: 1,
        limit: 10,
      });

      if (!activeEquipment.data || activeEquipment.data.length === 0) {
        console.log('[AppService] No active equipment found for simulation');
        return;
      }

      // Create sample route for the first equipment
      const equipment = activeEquipment.data[0];
      if (!equipment) {
        console.log('[AppService] No equipment found for simulation');
        return;
      }

      const sampleRoute: Position[] = [
        {
          latitude: 37.7749,
          longitude: -122.4194,
          altitude: 10,
          accuracy: 2.5,
          timestamp: new Date(),
          distanceTo(lastPosition: Position): unknown {
            throw new Error('Function not implemented.');
          },
        },
        {
          latitude: 37.775,
          longitude: -122.4195,
          altitude: 10,
          accuracy: 2.0,
          timestamp: new Date(),
          distanceTo(lastPosition: Position): unknown {
            throw new Error('Function not implemented.');
          },
        },
        {
          latitude: 37.7751,
          longitude: -122.4196,
          altitude: 11,
          accuracy: 1.8,
          timestamp: new Date(),
          distanceTo(lastPosition: Position): unknown {
            throw new Error('Function not implemented.');
          },
        },
        {
          latitude: 37.7752,
          longitude: -122.4197,
          altitude: 11,
          accuracy: 2.2,
          timestamp: new Date(),
          distanceTo(lastPosition: Position): unknown {
            throw new Error('Function not implemented.');
          },
        },
        {
          latitude: 37.7753,
          longitude: -122.4198,
          altitude: 12,
          accuracy: 1.9,
          timestamp: new Date(),
          distanceTo(lastPosition: Position): unknown {
            throw new Error('Function not implemented.');
          },
        },
      ];

      // Start simulation
      await this.gpsTrackingService.simulateMovement(equipment.id, sampleRoute, 3000); // 3 seconds between points

      console.log(`[AppService] Demo simulation started for equipment: ${equipment.id}`);
    } catch (error) {
      console.error('[AppService] Failed to start demo simulation:', error);
      throw error;
    }
  }

  /**
   * Stop all simulations
   */
  async stopAllSimulations(): Promise<void> {
    try {
      const equipment = await this.equipmentService.getAllEquipment({ page: 1, limit: 1000 });

      if (equipment.data) {
        for (const eq of equipment.data) {
          this.gpsTrackingService.stopSimulation(eq.id);
        }
      }

      console.log('[AppService] All simulations stopped');
    } catch (error) {
      console.error('[AppService] Failed to stop simulations:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive application statistics
   */
  async getApplicationStatistics(): Promise<{
    equipment: any;
    tracking: any;
    alerts: any;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
  }> {
    try {
      const [fleetStats, trackingStats, alertStats] = await Promise.all([
        this.equipmentService.getFleetStatistics(),
        this.gpsTrackingService.getTrackingStatistics(),
        this.alertService.getAlertStatistics(),
      ]);

      return {
        equipment: fleetStats,
        tracking: trackingStats,
        alerts: alertStats,
        uptime: Date.now() - this.startTime.getTime(),
        memoryUsage: process.memoryUsage(),
      };
    } catch (error) {
      console.error('[AppService] Failed to get application statistics:', error);
      throw error;
    }
  }
}

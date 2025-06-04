/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-depth */
/* eslint-disable complexity */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-console */
/**
 * GPS Tracking Service - Handles real-time position updates and GPS data processing
 */

import { EventEmitter } from 'events';
import {
  Position,
  CreatePositionData,
  EquipmentId,
  PositionSource,
  GpsData,
  NmeaData,
  NmeaMessageType,
  PositionCallback,
  Timestamp,
  Distance,
} from '../types/index.js';
import type { IPositionRepository } from '../repositories/position.repository.js';
import type { IEquipmentService } from './equipment.service.js';
import { Position as PositionModel } from '../models/position.js';

export interface IGpsTrackingService {
  // Position processing
  processPositionUpdate(
    equipmentId: EquipmentId,
    positionData: CreatePositionData,
    source?: PositionSource,
  ): Promise<void>;
  processNmeaData(equipmentId: EquipmentId, nmeaData: string): Promise<void>;

  // Real-time tracking
  startTracking(equipmentId: EquipmentId): Promise<void>;
  stopTracking(equipmentId: EquipmentId): Promise<void>;
  isTracking(equipmentId: EquipmentId): boolean;

  // Position simulation (for development)
  simulateMovement(equipmentId: EquipmentId, route: Position[], intervalMs?: number): Promise<void>;
  stopSimulation(equipmentId: EquipmentId): void;

  // Event handling
  onPositionUpdate(callback: (equipmentId: EquipmentId, position: Position) => void): void;
  onMovementDetected(callback: (equipmentId: EquipmentId, speed: number) => void): void;
  onGeofenceViolation(
    callback: (equipmentId: EquipmentId, position: Position, geofenceId: string) => void,
  ): void;

  // Analytics
  getTrackingStatistics(): Promise<{
    totalTrackedEquipment: number;
    activeTracking: number;
    positionsProcessedToday: number;
    averageAccuracy: number;
    lastUpdateTimes: Record<EquipmentId, Timestamp>;
  }>;
}

export class GpsTrackingService extends EventEmitter implements IGpsTrackingService {
  private trackingStates = new Map<
    EquipmentId,
    {
      isTracking: boolean;
      lastPosition?: Position | undefined;
      simulationInterval?: NodeJS.Timeout | undefined;
      routeIndex?: number | undefined;
    }
  >();

  private positionsProcessedToday = 0;
  private totalAccuracy = 0;
  private accuracyCount = 0;

  constructor(
    private positionRepository: IPositionRepository,
    private equipmentService: IEquipmentService,
  ) {
    super();
    this.initializeService();
  }

  private initializeService(): void {
    console.log('[GpsTrackingService] Initializing GPS tracking service');

    // Reset daily statistics at midnight
    this.scheduleStatisticsReset();
  }

  async processPositionUpdate(
    equipmentId: EquipmentId,
    positionData: CreatePositionData,
    source: PositionSource = PositionSource.GPS,
  ): Promise<void> {
    try {
      // Validate position data
      const position = new PositionModel(positionData);

      // Check for significant movement (avoid processing duplicate positions)
      const lastPosition = this.getLastPosition(equipmentId);
      if (lastPosition && this.isDuplicatePosition(position, lastPosition)) {
        console.log(
          `[GpsTrackingService] Ignoring duplicate position for equipment ${equipmentId}`,
        );
        return;
      }

      // Store position
      await this.positionRepository.create({
        equipmentId,
        ...positionData,
      });

      // Update equipment's last position
      await this.equipmentService.updateEquipmentPosition(equipmentId, position);

      // Update tracking state
      this.updateTrackingState(equipmentId, position);

      // Update statistics
      this.updateStatistics(position);

      // Emit events
      this.emit('positionUpdate', equipmentId, position);

      // Check for movement
      if (lastPosition) {
        const speed = this.calculateSpeed(lastPosition, position);
        if (speed > 0.5) {
          // 0.5 m/s threshold
          this.emit('movementDetected', equipmentId, speed);
        }
      }

      console.log(`[GpsTrackingService] Processed position update for equipment ${equipmentId}`);
    } catch (error) {
      console.error(
        `[GpsTrackingService] Failed to process position update for equipment ${equipmentId}:`,
        error,
      );
      throw error;
    }
  }

  async processNmeaData(equipmentId: EquipmentId, nmeaData: string): Promise<void> {
    try {
      const parsedData = this.parseNmeaData(nmeaData);

      if (parsedData?.position) {
        await this.processPositionUpdate(equipmentId, parsedData.position, PositionSource.GPS);
      }
    } catch (error) {
      console.error(
        `[GpsTrackingService] Failed to process NMEA data for equipment ${equipmentId}:`,
        error,
      );
      throw error;
    }
  }

  async startTracking(equipmentId: EquipmentId): Promise<void> {
    try {
      // Ensure equipment exists
      await this.equipmentService.getEquipment(equipmentId);

      const state = this.trackingStates.get(equipmentId) ?? { isTracking: false };
      state.isTracking = true;
      this.trackingStates.set(equipmentId, state);

      console.log(`[GpsTrackingService] Started tracking equipment ${equipmentId}`);
    } catch (error) {
      console.error(
        `[GpsTrackingService] Failed to start tracking equipment ${equipmentId}:`,
        error,
      );
      throw error;
    }
  }

  async stopTracking(equipmentId: EquipmentId): Promise<void> {
    const state = this.trackingStates.get(equipmentId);
    if (state) {
      state.isTracking = false;

      // Stop any simulation
      if (state.simulationInterval) {
        clearInterval(state.simulationInterval);
        state.simulationInterval = undefined;
      }

      this.trackingStates.set(equipmentId, state);
    }

    console.log(`[GpsTrackingService] Stopped tracking equipment ${equipmentId}`);
  }

  isTracking(equipmentId: EquipmentId): boolean {
    const state = this.trackingStates.get(equipmentId);
    return state?.isTracking ?? false;
  }

  async simulateMovement(
    equipmentId: EquipmentId,
    route: Position[],
    intervalMs: number = 5000,
  ): Promise<void> {
    try {
      // Ensure equipment exists
      await this.equipmentService.getEquipment(equipmentId);

      // Start tracking if not already tracking
      if (!this.isTracking(equipmentId)) {
        await this.startTracking(equipmentId);
      }

      const state = this.trackingStates.get(equipmentId) ?? { isTracking: true };
      this.trackingStates.set(equipmentId, state);

      // Stop existing simulation
      if (state.simulationInterval) {
        clearInterval(state.simulationInterval);
      }

      state.routeIndex = 0;

      // Start simulation
      state.simulationInterval = setInterval(() => {
        if (state.routeIndex !== undefined && state.routeIndex < route.length) {
          const position = route[state.routeIndex];

          if (position) {
            this.processPositionUpdate(
              equipmentId,
              {
                latitude: position.latitude,
                longitude: position.longitude,
                altitude: position.altitude,
                accuracy: position.accuracy,
                timestamp: new Date(),
              },
              PositionSource.Simulation,
            ).catch(err => {
              console.error(
                `[GpsTrackingService] Error in simulation for equipment ${equipmentId}:`,
                err,
              );
            });
            state.routeIndex++;
          }
        } else {
          // Route completed, stop simulation
          this.stopSimulation(equipmentId);
        }
      }, intervalMs);

      this.trackingStates.set(equipmentId, state);

      console.log(
        `[GpsTrackingService] Started simulation for equipment ${equipmentId} with ${route.length} waypoints`,
      );
    } catch (error) {
      console.error(
        `[GpsTrackingService] Failed to start simulation for equipment ${equipmentId}:`,
        error,
      );
      throw error;
    }
  }

  stopSimulation(equipmentId: EquipmentId): void {
    const state = this.trackingStates.get(equipmentId);
    if (state?.simulationInterval) {
      clearInterval(state.simulationInterval);
      state.simulationInterval = undefined;
      state.routeIndex = undefined;
      this.trackingStates.set(equipmentId, state);

      console.log(`[GpsTrackingService] Stopped simulation for equipment ${equipmentId}`);
    }
  }

  onPositionUpdate(callback: (equipmentId: EquipmentId, position: Position) => void): void {
    this.on('positionUpdate', callback);
  }

  onMovementDetected(callback: (equipmentId: EquipmentId, speed: number) => void): void {
    this.on('movementDetected', callback);
  }

  onGeofenceViolation(
    callback: (equipmentId: EquipmentId, position: Position, geofenceId: string) => void,
  ): void {
    this.on('geofenceViolation', callback);
  }

  async getTrackingStatistics(): Promise<{
    totalTrackedEquipment: number;
    activeTracking: number;
    positionsProcessedToday: number;
    averageAccuracy: number;
    lastUpdateTimes: Record<EquipmentId, Timestamp>;
  }> {
    const totalTrackedEquipment = this.trackingStates.size;
    const activeTracking = Array.from(this.trackingStates.values()).filter(
      state => state.isTracking,
    ).length;

    const averageAccuracy = this.accuracyCount > 0 ? this.totalAccuracy / this.accuracyCount : 0;

    const lastUpdateTimes: Record<EquipmentId, Timestamp> = {};
    for (const [equipmentId, state] of this.trackingStates.entries()) {
      if (state.lastPosition) {
        lastUpdateTimes[equipmentId] = state.lastPosition.timestamp;
      }
    }

    return {
      totalTrackedEquipment,
      activeTracking,
      positionsProcessedToday: this.positionsProcessedToday,
      averageAccuracy,
      lastUpdateTimes,
    };
  }

  // Private helper methods
  private getLastPosition(equipmentId: EquipmentId): Position | undefined {
    return this.trackingStates.get(equipmentId)?.lastPosition;
  }

  private isDuplicatePosition(newPosition: Position, lastPosition: Position): boolean {
    const distance = newPosition.distanceTo(lastPosition) as number;
    const timeDiff = newPosition.timestamp.getTime() - lastPosition.timestamp.getTime();

    // Consider duplicate if less than 1 meter movement in less than 30 seconds
    return distance < 1.0 && timeDiff < 30000;
  }

  private updateTrackingState(equipmentId: EquipmentId, position: Position): void {
    const state = this.trackingStates.get(equipmentId) ?? { isTracking: true };
    state.lastPosition = position;
    this.trackingStates.set(equipmentId, state);
  }

  private updateStatistics(position: Position): void {
    this.positionsProcessedToday++;
    this.totalAccuracy += position.accuracy;
    this.accuracyCount++;
  }

  private calculateSpeed(lastPosition: Position, currentPosition: Position): number {
    const distance = lastPosition.distanceTo(currentPosition) as Distance;
    const timeDiff =
      (currentPosition.timestamp.getTime() - lastPosition.timestamp.getTime()) / 1000; // seconds

    return timeDiff > 0 ? distance / timeDiff : 0;
  }

  private parseNmeaData(nmeaData: string): { position?: CreatePositionData } | null {
    try {
      // Basic NMEA parsing - simplified implementation
      const lines = nmeaData.split('\n').filter(line => line.trim().length > 0);

      for (const line of lines) {
        if (line.startsWith('$GPGGA') || line.startsWith('$GNGGA')) {
          // Parse GGA sentence for position
          const parts = line.split(',');

          if (parts && parts.length >= 15) {
            const lat = this.parseCoordinate(parts[2] ?? '', parts[3] ?? '');
            const lng = this.parseCoordinate(parts[4] ?? '', parts[5] ?? '');
            const altitude = parseFloat(parts[9] ?? '') || 0;
            const quality = parseInt(parts[6] ?? '') || 0;

            if (lat !== null && lng !== null && quality > 0) {
              return {
                position: {
                  latitude: lat,
                  longitude: lng,
                  altitude,
                  accuracy: this.qualityToAccuracy(quality),
                  timestamp: new Date(),
                },
              };
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[GpsTrackingService] Failed to parse NMEA data:', error);
      return null;
    }
  }

  private parseCoordinate(value: string, direction: string): number | null {
    if (!value || !direction) {
      return null;
    }

    const coord = parseFloat(value);
    if (isNaN(coord)) {
      return null;
    }

    // Convert DDMM.MMMM to decimal degrees
    const degrees = Math.floor(coord / 100);
    const minutes = coord % 100;
    let decimal = degrees + minutes / 60;

    // Apply direction
    if (direction === 'S' || direction === 'W') {
      decimal = -decimal;
    }

    return decimal;
  }

  private qualityToAccuracy(quality: number): number {
    // Convert GPS quality indicator to accuracy estimate
    switch (quality) {
      case 1:
        return 5.0; // Standard GPS
      case 2:
        return 2.0; // Differential GPS
      case 3:
        return 1.0; // PPS
      case 4:
        return 0.5; // RTK
      case 5:
        return 0.2; // Float RTK
      default:
        return 10.0; // Unknown/poor quality
    }
  }

  private scheduleStatisticsReset(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.resetDailyStatistics();

      // Schedule daily reset
      setInterval(
        () => {
          this.resetDailyStatistics();
        },
        24 * 60 * 60 * 1000,
      );
    }, msUntilMidnight);
  }

  private resetDailyStatistics(): void {
    this.positionsProcessedToday = 0;
    this.totalAccuracy = 0;
    this.accuracyCount = 0;
    console.log('[GpsTrackingService] Daily statistics reset');
  }
}

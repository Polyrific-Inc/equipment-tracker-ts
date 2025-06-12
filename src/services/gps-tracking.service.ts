/* eslint-disable @typescript-eslint/no-explicit-any */
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
  PositionCallback,
  Timestamp,
  Distance,
} from '../types/index.js';
import type { IPositionRepository } from '../repositories/position.repository.js';
import type { IEquipmentService } from './equipment.service.js';

// Enhanced statistics interfaces
export interface TrackingQualityMetrics {
  accuracyDistribution: {
    excellent: number; // <2m
    good: number; // 2-5m
    fair: number; // 5-10m
    poor: number; // >10m
  };
  signalQuality: {
    averageAccuracy: number;
    medianAccuracy: number;
    accuracyTrend: 'improving' | 'stable' | 'degrading';
  };
  dataIntegrity: {
    validPositions: number;
    invalidPositions: number;
    duplicatePositions: number;
    outOfSequencePositions: number;
  };
}

export interface PerformanceMetrics {
  processing: {
    averageProcessingTime: number; // ms
    peakProcessingTime: number;
    totalProcessingTime: number;
    failedProcessingCount: number;
  };
  throughput: {
    positionsPerMinute: number;
    positionsPerHour: number;
    peakThroughput: number;
    averageThroughput: number;
  };
  reliability: {
    uptime: number; // percentage
    errorRate: number; // percentage
    connectionStability: number; // percentage
  };
}

export interface OperationalMetrics {
  coverage: {
    totalEquipmentCount: number;
    trackedEquipementCount: number;
    activelyTrackedCount: number;
    coveragePercentage: number;
  };
  activity: {
    movingEquipment: number;
    stationaryEquipment: number;
    recentlyActiveEquipment: number;
    inactiveEquipment: number;
  };
  temporal: {
    positionsToday: number;
    positionsThisWeek: number;
    positionsThisMonth: number;
    dailyAverage: number;
    hourlyDistribution: number[];
  };
}

export interface ComprehensiveTrackingStatistics {
  timestamp: Timestamp;
  quality: TrackingQualityMetrics;
  performance: PerformanceMetrics;
  operational: OperationalMetrics;
  equipmentDetails: Record<
    EquipmentId,
    {
      lastUpdate: Timestamp;
      positionCount: number;
      averageAccuracy: number;
      isActive: boolean;
      isMoving: boolean;
      connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
      dataGaps: number;
    }
  >;
}

// Performance tracking for individual operations
interface OperationMetrics {
  startTime: number;
  endTime?: number;
  success: boolean;
  error?: string;
}

// Historical data point for trend analysis
interface DataPoint {
  timestamp: Timestamp;
  value: number;
  metadata?: Record<string, unknown>;
}

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

  // Enhanced analytics
  getComprehensiveStatistics(): Promise<ComprehensiveTrackingStatistics>;
}

export class GpsTrackingService extends EventEmitter implements IGpsTrackingService {
  private trackingStates = new Map<
    EquipmentId,
    {
      isTracking: boolean;
      lastPosition: Position | undefined;
      simulationInterval: NodeJS.Timeout | undefined;
      routeIndex: number | undefined;
      connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
      consecutiveErrors: number;
      lastErrorTime?: Timestamp;
    }
  >();

  // Enhanced statistics tracking
  private statisticsStore = {
    // Performance metrics
    operationMetrics: new Map<string, OperationMetrics>(),
    processingTimes: [] as number[],
    throughputHistory: [] as DataPoint[],

    // Quality metrics
    accuracyHistory: [] as DataPoint[],
    invalidPositionCount: 0,
    duplicatePositionCount: 0,
    outOfSequenceCount: 0,

    // Temporal tracking
    dailyPositionCounts: new Map<string, number>(),
    hourlyDistribution: new Array(24).fill(0),

    // Error tracking
    errorLog: [] as Array<{ timestamp: Timestamp; error: string; equipmentId?: EquipmentId }>,
    connectionIssues: new Map<EquipmentId, number>(),

    // Service health
    serviceStartTime: new Date(),
    lastStatsReset: new Date(),
  };

  constructor(
    private positionRepository: IPositionRepository,
    private equipmentService: IEquipmentService,
  ) {
    super();
    this.initializeEnhancedService();
  }

  private initializeEnhancedService(): void {
    console.log('[Enhanced GPS Tracking] Initializing with comprehensive statistics...');

    // Schedule periodic statistics updates
    this.scheduleStatisticsCollection();

    // Schedule cleanup of old metrics
    this.scheduleMetricsCleanup();

    // Initialize hourly distribution tracking
    this.startHourlyTracking();
  }

  /**
   * Enhanced position processing with comprehensive metrics collection
   */
  async processPositionUpdate(
    equipmentId: EquipmentId,
    positionData: CreatePositionData,
    source: PositionSource = PositionSource.GPS,
  ): Promise<void> {
    const operationId = `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    try {
      // Record operation start
      this.statisticsStore.operationMetrics.set(operationId, {
        startTime,
        success: false,
      });

      // Validate and process position
      const validationResult = await this.validatePosition(equipmentId, positionData);

      if (!validationResult.isValid) {
        this.statisticsStore.invalidPositionCount++;
        throw new Error(`Invalid position: ${validationResult.errors.join(', ')}`);
      }

      // Check for duplicates
      if (await this.isDuplicatePosition(equipmentId, positionData)) {
        this.statisticsStore.duplicatePositionCount++;
        console.log(`[Enhanced GPS] Duplicate position detected for ${equipmentId}`);
        return;
      }

      // Check sequence integrity
      if (await this.isOutOfSequence(equipmentId, positionData)) {
        this.statisticsStore.outOfSequenceCount++;
        console.warn(`[Enhanced GPS] Out-of-sequence position for ${equipmentId}`);
      }

      // Store position
      await this.positionRepository.create({
        equipmentId,
        ...positionData,
      });

      // Update equipment position
      const position = this.createPositionObject(positionData);
      await this.equipmentService.updateEquipmentPosition(equipmentId, position);

      // Update tracking state and metrics
      this.updateTrackingState(equipmentId, position, source);
      this.updateStatistics(position, source);
      this.updateConnectionQuality(equipmentId, true);

      // Record successful operation
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      this.statisticsStore.operationMetrics.set(operationId, {
        startTime,
        endTime,
        success: true,
      });

      this.statisticsStore.processingTimes.push(processingTime);

      // Emit events
      this.emit('positionUpdate', equipmentId, position);
      this.checkForMovement(equipmentId, position);

      console.log(
        `[Enhanced GPS] Processed position for ${equipmentId} in ${processingTime.toFixed(2)}ms`,
      );
    } catch (error) {
      // Record error
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.recordError(equipmentId, errorMessage);
      this.updateConnectionQuality(equipmentId, false);

      // Update operation metrics
      this.statisticsStore.operationMetrics.set(operationId, {
        startTime,
        endTime: performance.now(),
        success: false,
        error: errorMessage,
      });

      console.error(`[Enhanced GPS] Failed to process position for ${equipmentId}:`, error);
      throw error;
    }
  }

  /**
   * Get comprehensive tracking statistics
   */
  async getComprehensiveStatistics(): Promise<ComprehensiveTrackingStatistics> {
    const now = new Date();

    // Calculate quality metrics
    const quality = await this.calculateQualityMetrics();

    // Calculate performance metrics
    const performance = this.calculatePerformanceMetrics();

    // Calculate operational metrics
    const operational = await this.calculateOperationalMetrics();

    // Get equipment details
    const equipmentDetails = await this.getEquipmentDetails();

    return {
      timestamp: now,
      quality,
      performance,
      operational,
      equipmentDetails,
    };
  }

  /**
   * Calculate quality metrics
   */
  private async calculateQualityMetrics(): Promise<TrackingQualityMetrics> {
    const recentAccuracies = this.statisticsStore.accuracyHistory
      .filter(dp => dp.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000))
      .map(dp => dp.value);

    // Accuracy distribution
    const accuracyDistribution = {
      excellent: recentAccuracies.filter(acc => acc < 2).length,
      good: recentAccuracies.filter(acc => acc >= 2 && acc < 5).length,
      fair: recentAccuracies.filter(acc => acc >= 5 && acc < 10).length,
      poor: recentAccuracies.filter(acc => acc >= 10).length,
    };

    // Signal quality calculations
    const averageAccuracy =
      recentAccuracies.length > 0
        ? recentAccuracies.reduce((sum, acc) => sum + acc, 0) / recentAccuracies.length
        : 0;

    const sortedAccuracies = recentAccuracies.sort((a, b) => a - b);
    const medianAccuracy =
      sortedAccuracies.length > 0 ? sortedAccuracies[Math.floor(sortedAccuracies.length / 2)] : 0;

    // Trend analysis (simplified)
    const recentAvg =
      recentAccuracies.slice(-100).reduce((sum, acc) => sum + acc, 0) /
      Math.max(1, recentAccuracies.slice(-100).length);
    const olderAvg =
      recentAccuracies.slice(-200, -100).reduce((sum, acc) => sum + acc, 0) /
      Math.max(1, recentAccuracies.slice(-200, -100).length);

    let accuracyTrend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (recentAvg < olderAvg * 0.9) {
      accuracyTrend = 'improving';
    } else if (recentAvg > olderAvg * 1.1) {
      accuracyTrend = 'degrading';
    }

    return {
      accuracyDistribution,
      signalQuality: {
        averageAccuracy,
        medianAccuracy: medianAccuracy ?? 0,
        accuracyTrend,
      },
      dataIntegrity: {
        validPositions:
          this.getTotalPositionsProcessed() - this.statisticsStore.invalidPositionCount,
        invalidPositions: this.statisticsStore.invalidPositionCount,
        duplicatePositions: this.statisticsStore.duplicatePositionCount,
        outOfSequencePositions: this.statisticsStore.outOfSequenceCount,
      },
    };
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(): PerformanceMetrics {
    const processingTimes = this.statisticsStore.processingTimes.slice(-1000); // Last 1000 operations
    const operations = Array.from(this.statisticsStore.operationMetrics.values()).slice(-1000);

    const averageProcessingTime =
      processingTimes.length > 0
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
        : 0;

    const peakProcessingTime = processingTimes.length > 0 ? Math.max(...processingTimes) : 0;
    const totalProcessingTime = processingTimes.reduce((sum, time) => sum + time, 0);
    const failedProcessingCount = operations.filter(op => !op.success).length;

    // Throughput calculations
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneMinuteAgo = now - 60 * 1000;

    const recentThroughput = this.statisticsStore.throughputHistory.filter(
      dp => dp.timestamp.getTime() > oneHourAgo,
    );

    const positionsPerMinute = recentThroughput
      .filter(dp => dp.timestamp.getTime() > oneMinuteAgo)
      .reduce((sum, dp) => sum + dp.value, 0);

    const positionsPerHour = recentThroughput.reduce((sum, dp) => sum + dp.value, 0);

    // Service reliability
    const uptime =
      ((now - this.statisticsStore.serviceStartTime.getTime()) /
        (now - this.statisticsStore.serviceStartTime.getTime())) *
      100;
    const errorRate = operations.length > 0 ? (failedProcessingCount / operations.length) * 100 : 0;

    return {
      processing: {
        averageProcessingTime,
        peakProcessingTime,
        totalProcessingTime,
        failedProcessingCount,
      },
      throughput: {
        positionsPerMinute,
        positionsPerHour,
        peakThroughput: Math.max(...recentThroughput.map(dp => dp.value), 0),
        averageThroughput:
          recentThroughput.length > 0
            ? recentThroughput.reduce((sum, dp) => sum + dp.value, 0) / recentThroughput.length
            : 0,
      },
      reliability: {
        uptime,
        errorRate,
        connectionStability: this.calculateConnectionStability(),
      },
    };
  }

  /**
   * Calculate operational metrics
   */
  private async calculateOperationalMetrics(): Promise<OperationalMetrics> {
    const allEquipment = await this.equipmentService.getAllEquipment({ page: 1, limit: 1000 });
    const totalEquipmentCount = allEquipment.pagination.total;
    const trackedEquipmentCount = this.trackingStates.size;
    const activelyTrackedCount = Array.from(this.trackingStates.values()).filter(
      state => state.isTracking,
    ).length;

    // Activity metrics
    let movingEquipment = 0;
    let stationaryEquipment = 0;
    let recentlyActiveEquipment = 0;
    let inactiveEquipment = 0;

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    for (const [equipmentId, state] of this.trackingStates.entries()) {
      if (state.lastPosition) {
        if (state.lastPosition.timestamp > thirtyMinutesAgo) {
          recentlyActiveEquipment++;
          // Simplified movement detection
          movingEquipment++;
        } else {
          stationaryEquipment++;
        }
      } else {
        inactiveEquipment++;
      }
    }

    // Temporal metrics
    const today = new Date().toISOString().split('T')[0] ?? '';
    const positionsToday = this.statisticsStore.dailyPositionCounts.get(today) ?? 0;

    return {
      coverage: {
        totalEquipmentCount,
        trackedEquipementCount: trackedEquipmentCount,
        activelyTrackedCount,
        coveragePercentage:
          totalEquipmentCount > 0 ? (trackedEquipmentCount / totalEquipmentCount) * 100 : 0,
      },
      activity: {
        movingEquipment,
        stationaryEquipment,
        recentlyActiveEquipment,
        inactiveEquipment,
      },
      temporal: {
        positionsToday,
        positionsThisWeek: this.calculateWeeklyPositions(),
        positionsThisMonth: this.calculateMonthlyPositions(),
        dailyAverage: this.calculateDailyAverage(),
        hourlyDistribution: [...this.statisticsStore.hourlyDistribution],
      },
    };
  }

  /**
   * Get detailed equipment metrics
   */
  private async getEquipmentDetails(): Promise<Record<EquipmentId, any>> {
    const details: Record<EquipmentId, any> = {};

    for (const [equipmentId, state] of this.trackingStates.entries()) {
      const positionCount = await this.positionRepository.getPositionCount(equipmentId);

      details[equipmentId] = {
        lastUpdate: state.lastPosition?.timestamp ?? new Date(0),
        positionCount,
        averageAccuracy: await this.calculateEquipmentAverageAccuracy(equipmentId),
        isActive: state.isTracking,
        isMoving: this.isEquipmentMoving(equipmentId),
        connectionQuality: state.connectionQuality,
        dataGaps: this.calculateDataGaps(equipmentId),
      };
    }

    return details;
  }

  // Helper methods for statistics calculation
  private validatePosition(
    equipmentId: EquipmentId,
    position: CreatePositionData,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (position.latitude < -90 || position.latitude > 90) {
      errors.push('Invalid latitude');
    }

    if (position.longitude < -180 || position.longitude > 180) {
      errors.push('Invalid longitude');
    }

    if (position.accuracy && position.accuracy < 0) {
      errors.push('Invalid accuracy');
    }

    return Promise.resolve({
      isValid: errors.length === 0,
      errors,
    });
  }

  private async isDuplicatePosition(
    equipmentId: EquipmentId,
    position: CreatePositionData,
  ): Promise<boolean> {
    const lastPosition = this.trackingStates.get(equipmentId)?.lastPosition;
    if (!lastPosition) {
      return false;
    }

    const distance = this.calculateDistance(
      position.latitude,
      position.longitude,
      lastPosition.latitude,
      lastPosition.longitude,
    );

    const timeDiff =
      (position.timestamp?.getTime() ?? Date.now()) - lastPosition.timestamp.getTime();

    // Consider duplicate if same location within 1 meter and within 10 seconds
    return distance < 1 && Math.abs(timeDiff) < 10000;
  }

  private async isOutOfSequence(
    equipmentId: EquipmentId,
    position: CreatePositionData,
  ): Promise<boolean> {
    const lastPosition = this.trackingStates.get(equipmentId)?.lastPosition;
    if (!lastPosition) {
      return false;
    }

    const positionTime = position.timestamp?.getTime() ?? Date.now();
    return positionTime < lastPosition.timestamp.getTime();
  }

  private createPositionObject(data: CreatePositionData): Position {
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      altitude: data.altitude ?? 0,
      accuracy: data.accuracy ?? 2.5,
      timestamp: data.timestamp ?? new Date(),
      distanceTo(other: Position): number {
        const R = 6371e3; // Earth radius in meters
        const φ1 = (this.latitude * Math.PI) / 180;
        const φ2 = (other.latitude * Math.PI) / 180;
        const Δφ = ((other.latitude - this.latitude) * Math.PI) / 180;
        const Δλ = ((other.longitude - this.longitude) * Math.PI) / 180;

        const a =
          Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
      },
    };
  }

  private updateTrackingState(
    equipmentId: EquipmentId,
    position: Position,
    source: PositionSource,
  ): void {
    const state = this.trackingStates.get(equipmentId) ?? {
      isTracking: true,
      lastPosition: undefined,
      simulationInterval: undefined,
      routeIndex: undefined,
      connectionQuality: 'good' as const,
      consecutiveErrors: 0,
    };

    state.lastPosition = position;
    state.isTracking = true;
    this.trackingStates.set(equipmentId, state);
  }

  private updateStatistics(position: Position, source: PositionSource): void {
    // Update accuracy history
    this.statisticsStore.accuracyHistory.push({
      timestamp: new Date(),
      value: position.accuracy,
      metadata: { source },
    });

    // Update daily counts
    const today = new Date().toISOString().split('T')[0] ?? '';
    const currentCount = this.statisticsStore.dailyPositionCounts.get(today) ?? 0;
    this.statisticsStore.dailyPositionCounts.set(today, currentCount + 1);

    // Update hourly distribution
    const hour = new Date().getHours();
    this.statisticsStore.hourlyDistribution[hour]++;

    // Update throughput
    this.statisticsStore.throughputHistory.push({
      timestamp: new Date(),
      value: 1, // One position processed
    });

    // Keep only recent data
    this.trimHistoricalData();
  }

  private updateConnectionQuality(equipmentId: EquipmentId, success: boolean): void {
    const state = this.trackingStates.get(equipmentId);
    if (!state) {
      return;
    }

    if (success) {
      state.consecutiveErrors = 0;
      state.connectionQuality = 'excellent';
    } else {
      state.consecutiveErrors++;
      if (state.consecutiveErrors > 10) {
        state.connectionQuality = 'poor';
      } else if (state.consecutiveErrors > 5) {
        state.connectionQuality = 'fair';
      } else {
        state.connectionQuality = 'good';
      }
    }
  }

  private recordError(equipmentId: EquipmentId | undefined, error: string): void {
    this.statisticsStore.errorLog.push({
      timestamp: new Date(),
      error,
      ...(equipmentId && { equipmentId }),
    });

    if (equipmentId) {
      const currentCount = this.statisticsStore.connectionIssues.get(equipmentId) ?? 0;
      this.statisticsStore.connectionIssues.set(equipmentId, currentCount + 1);
    }
  }

  // Additional helper methods...
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private calculateConnectionStability(): number {
    const recentErrors = this.statisticsStore.errorLog.filter(
      err => err.timestamp > new Date(Date.now() - 60 * 60 * 1000),
    ).length;

    const totalOperations = this.statisticsStore.processingTimes.length;
    return totalOperations > 0 ? Math.max(0, 100 - (recentErrors / totalOperations) * 100) : 100;
  }

  private scheduleStatisticsCollection(): void {
    // Collect throughput every minute
    setInterval(() => {
      const minute = new Date().getMinutes();
      const recentOperations = Array.from(this.statisticsStore.operationMetrics.values()).filter(
        op => op.startTime > Date.now() - 60000,
      ).length;

      this.statisticsStore.throughputHistory.push({
        timestamp: new Date(),
        value: recentOperations,
      });
    }, 60000);
  }

  private scheduleMetricsCleanup(): void {
    // Clean up old metrics every hour
    setInterval(
      () => {
        this.trimHistoricalData();
      },
      60 * 60 * 1000,
    );
  }

  private startHourlyTracking(): void {
    // Reset hourly distribution daily
    setInterval(
      () => {
        this.statisticsStore.hourlyDistribution.fill(0);
      },
      24 * 60 * 60 * 1000,
    );
  }

  private trimHistoricalData(): void {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Trim accuracy history (keep last 24 hours)
    this.statisticsStore.accuracyHistory = this.statisticsStore.accuracyHistory.filter(
      dp => dp.timestamp.getTime() > oneDayAgo,
    );

    // Trim throughput history
    this.statisticsStore.throughputHistory = this.statisticsStore.throughputHistory.filter(
      dp => dp.timestamp.getTime() > oneDayAgo,
    );

    // Trim processing times (keep last 1000)
    if (this.statisticsStore.processingTimes.length > 1000) {
      this.statisticsStore.processingTimes = this.statisticsStore.processingTimes.slice(-1000);
    }

    // Trim operation metrics (keep last 1000)
    const operations = Array.from(this.statisticsStore.operationMetrics.entries());
    if (operations.length > 1000) {
      this.statisticsStore.operationMetrics.clear();
      operations.slice(-1000).forEach(([key, value]) => {
        this.statisticsStore.operationMetrics.set(key, value);
      });
    }
  }

  // Original interface methods that need to be implemented

  async processNmeaData(equipmentId: EquipmentId, nmeaData: string): Promise<void> {
    try {
      const parsedData = this.parseNmeaData(nmeaData);

      if (parsedData?.position) {
        await this.processPositionUpdate(equipmentId, parsedData.position, PositionSource.GPS);
      }
    } catch (error) {
      console.error(
        `[Enhanced GPS] Failed to process NMEA data for equipment ${equipmentId}:`,
        error,
      );
      throw error;
    }
  }

  async startTracking(equipmentId: EquipmentId): Promise<void> {
    try {
      // Ensure equipment exists
      await this.equipmentService.getEquipment(equipmentId);

      const state = this.trackingStates.get(equipmentId) ?? {
        isTracking: false,
        lastPosition: undefined,
        simulationInterval: undefined,
        routeIndex: undefined,
        connectionQuality: 'good' as const,
        consecutiveErrors: 0,
      };
      state.isTracking = true;
      this.trackingStates.set(equipmentId, state);

      console.log(`[Enhanced GPS] Started tracking equipment ${equipmentId}`);
    } catch (error) {
      console.error(`[Enhanced GPS] Failed to start tracking equipment ${equipmentId}:`, error);
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

    console.log(`[Enhanced GPS] Stopped tracking equipment ${equipmentId}`);
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

      const state = this.trackingStates.get(equipmentId) ?? {
        isTracking: true,
        lastPosition: undefined,
        simulationInterval: undefined,
        routeIndex: undefined,
        connectionQuality: 'good' as const,
        consecutiveErrors: 0,
      };
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
                `[Enhanced GPS] Error in simulation for equipment ${equipmentId}:`,
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
        `[Enhanced GPS] Started simulation for equipment ${equipmentId} with ${route.length} waypoints`,
      );
    } catch (error) {
      console.error(
        `[Enhanced GPS] Failed to start simulation for equipment ${equipmentId}:`,
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

      console.log(`[Enhanced GPS] Stopped simulation for equipment ${equipmentId}`);
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

    const today = new Date().toISOString().split('T')[0] ?? '';
    const positionsProcessedToday = this.statisticsStore.dailyPositionCounts.get(today) ?? 0;

    const recentAccuracies = this.statisticsStore.accuracyHistory
      .filter(dp => dp.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000))
      .map(dp => dp.value);

    const averageAccuracy =
      recentAccuracies.length > 0
        ? recentAccuracies.reduce((sum, acc) => sum + acc, 0) / recentAccuracies.length
        : 0;

    const lastUpdateTimes: Record<EquipmentId, Timestamp> = {};
    for (const [equipmentId, state] of this.trackingStates.entries()) {
      if (state.lastPosition) {
        lastUpdateTimes[equipmentId] = state.lastPosition.timestamp;
      }
    }

    return {
      totalTrackedEquipment,
      activeTracking,
      positionsProcessedToday,
      averageAccuracy,
      lastUpdateTimes,
    };
  }

  // Helper method for NMEA parsing
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
      console.error('[Enhanced GPS] Failed to parse NMEA data:', error);
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
  private getTotalPositionsProcessed(): number {
    return Array.from(this.statisticsStore.dailyPositionCounts.values()).reduce(
      (sum, count) => sum + count,
      0,
    );
  }

  private calculateWeeklyPositions(): number {
    return 0; // Implementation needed
  }

  private calculateMonthlyPositions(): number {
    return 0; // Implementation needed
  }

  private calculateDailyAverage(): number {
    const counts = Array.from(this.statisticsStore.dailyPositionCounts.values());
    return counts.length > 0 ? counts.reduce((sum, count) => sum + count, 0) / counts.length : 0;
  }

  private async calculateEquipmentAverageAccuracy(equipmentId: EquipmentId): Promise<number> {
    return 2.5; // Placeholder
  }

  private isEquipmentMoving(equipmentId: EquipmentId): boolean {
    return false; // Placeholder
  }

  private calculateDataGaps(equipmentId: EquipmentId): number {
    return 0; // Placeholder
  }

  private checkForMovement(equipmentId: EquipmentId, position: Position): void {
    const lastPosition = this.trackingStates.get(equipmentId)?.lastPosition;
    if (!lastPosition) {
      return;
    }

    const distance = position.distanceTo(lastPosition) as Distance;
    const timeDiff = (position.timestamp.getTime() - lastPosition.timestamp.getTime()) / 1000;

    if (timeDiff > 0) {
      const speed = distance / timeDiff;
      if (speed > 0.5) {
        // 0.5 m/s threshold
        this.emit('movementDetected', equipmentId, speed);
      }
    }
  }
}

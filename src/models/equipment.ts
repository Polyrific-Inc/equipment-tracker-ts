/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-lines-per-function */
/**
 * Equipment domain model - represents a piece of heavy equipment with tracking capabilities
 */

import {
  IEquipment,
  CreateEquipmentData,
  UpdateEquipmentData,
  EquipmentType,
  EquipmentStatus,
  EquipmentId,
  Position as IPosition,
  PositionHistory,
  MovementAnalysis,
  Timestamp,
  Distance,
  Speed,
  Constants,
  EquipmentTypeLabels,
  EquipmentStatusLabels,
  isValidEquipmentId,
  isValidEquipmentType,
  isValidEquipmentStatus,
} from '../types/index.js';
import { Position } from './position.js';

export class Equipment implements IEquipment {
  readonly id: EquipmentId;
  readonly type: EquipmentType;
  name: string;
  status: EquipmentStatus;
  lastPosition?: Position;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;

  private positionHistory: Position[] = [];
  private readonly maxHistorySize: number;

  constructor(data: CreateEquipmentData) {
    // Validate input data
    this.validateEquipmentData(data);

    this.id = data.id;
    this.type = data.type;
    this.name = data.name;
    this.status = data.status ?? EquipmentStatus.Inactive;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.maxHistorySize = Constants.DEFAULT_MAX_HISTORY_SIZE;
  }

  /**
   * Validate equipment creation data
   */
  private validateEquipmentData(data: CreateEquipmentData): void {
    if (!isValidEquipmentId(data.id)) {
      throw new Error('Equipment ID must be a non-empty string');
    }

    if (!isValidEquipmentType(data.type)) {
      throw new Error(`Invalid equipment type: ${data.type}`);
    }

    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Equipment name must be a non-empty string');
    }

    if (data.status && !isValidEquipmentStatus(data.status)) {
      throw new Error(`Invalid equipment status: ${data.status}`);
    }
  }

  /**
   * Update equipment properties
   */
  update(data: UpdateEquipmentData): void {
    let hasChanges = false;

    if (data.name && data.name !== this.name) {
      if (data.name.trim().length === 0) {
        throw new Error('Equipment name cannot be empty');
      }
      this.name = data.name.trim();
      hasChanges = true;
    }

    if (data.status && data.status !== this.status) {
      if (!isValidEquipmentStatus(data.status)) {
        throw new Error(`Invalid equipment status: ${data.status}`);
      }
      this.status = data.status;
      hasChanges = true;
    }

    if (hasChanges) {
      (this as any).updatedAt = new Date(); // Update timestamp
    }
  }

  /**
   * Set the last known position
   */
  setLastPosition(position: Position | IPosition): void {
    this.lastPosition = position instanceof Position ? position : Position.fromInterface(position);
    (this as any).updatedAt = new Date();
  }

  /**
   * Record a new position and add it to history
   */
  recordPosition(position: Position | IPosition): void {
    const pos = position instanceof Position ? position : Position.fromInterface(position);

    // Add to history
    this.positionHistory.push(pos);

    // Update last position
    this.lastPosition = pos;

    // Maintain history size limit
    if (this.positionHistory.length > this.maxHistorySize) {
      this.positionHistory.shift(); // Remove oldest
    }

    // Update status to active when position is recorded
    if (this.status === EquipmentStatus.Inactive || this.status === EquipmentStatus.Unknown) {
      this.status = EquipmentStatus.Active;
    }

    (this as any).updatedAt = new Date();
  }

  /**
   * Get position history (returns copy to prevent mutation)
   */
  getPositionHistory(): PositionHistory {
    return [...this.positionHistory];
  }

  /**
   * Clear position history
   */
  clearPositionHistory(): void {
    this.positionHistory = [];
    (this as any).updatedAt = new Date();
  }

  /**
   * Get positions within a time range
   */
  getPositionsInTimeRange(startTime: Timestamp, endTime: Timestamp): Position[] {
    return this.positionHistory.filter(
      pos => pos.timestamp >= startTime && pos.timestamp <= endTime,
    );
  }

  /**
   * Check if equipment is currently moving
   */
  isMoving(): boolean {
    if (this.positionHistory.length < 2) {
      return false;
    }

    const latest = this.positionHistory[this.positionHistory.length - 1];
    const previous = this.positionHistory[this.positionHistory.length - 2];

    if (!latest || !previous) {
      return false;
    }

    // Calculate time difference in seconds
    const timeDiffMs = latest.timestamp.getTime() - previous.timestamp.getTime();
    const timeDiffSec = timeDiffMs / 1000;

    // Avoid division by zero
    if (timeDiffSec < 1) {
      return false;
    }

    // Calculate speed
    const distance = latest.distanceTo(previous);
    const speed = distance / timeDiffSec;

    return speed > Constants.MOVEMENT_SPEED_THRESHOLD;
  }

  /**
   * Get current speed (based on last two positions)
   */
  getCurrentSpeed(): Speed | undefined {
    if (this.positionHistory.length < 2) {
      return undefined;
    }

    const latest = this.positionHistory[this.positionHistory.length - 1];
    const previous = this.positionHistory[this.positionHistory.length - 2];

    if (!latest || !previous) {
      return undefined;
    }

    const timeDiffMs = latest.timestamp.getTime() - previous.timestamp.getTime();
    const timeDiffSec = timeDiffMs / 1000;

    if (timeDiffSec < 1) {
      return undefined;
    }

    const distance = latest.distanceTo(previous);
    return distance / timeDiffSec;
  }

  /**
   * Analyze movement patterns
   */
  analyzeMovement(timeRange?: { start: Timestamp; end: Timestamp }): MovementAnalysis {
    let positions = this.positionHistory;

    if (timeRange) {
      positions = this.getPositionsInTimeRange(timeRange.start, timeRange.end);
    }

    if (positions.length < 2) {
      return {
        isMoving: false,
        totalDistance: 0,
        movingTime: 0,
        stoppedTime: 0,
      };
    }

    let totalDistance = 0;
    let movingTime = 0;
    let stoppedTime = 0;
    const speeds: Speed[] = [];
    let lastMovementAt: Timestamp | undefined;

    for (let i = 1; i < positions.length; i++) {
      const current = positions[i];
      const previous = positions[i - 1];

      if (!current || !previous) {
        continue; // Skip if any position is invalid
      }

      const distance = current.distanceTo(previous);
      const timeDiffMs = current.timestamp.getTime() - previous.timestamp.getTime();
      const timeDiffSec = timeDiffMs / 1000;

      totalDistance += distance;

      if (timeDiffSec > 0) {
        const speed = distance / timeDiffSec;
        speeds.push(speed);

        if (speed > Constants.MOVEMENT_SPEED_THRESHOLD) {
          movingTime += timeDiffMs;
          lastMovementAt = current.timestamp;
        } else {
          stoppedTime += timeDiffMs;
        }
      }
    }

    const currentSpeed = this.getCurrentSpeed();
    const averageSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;

    return {
      isMoving: this.isMoving(),
      currentSpeed: currentSpeed ?? 0,
      averageSpeed,
      maxSpeed,
      totalDistance,
      movingTime,
      stoppedTime,
      lastMovementAt: lastMovementAt ?? new Date(),
    };
  }

  /**
   * Get the distance traveled since a specific time
   */
  getDistanceTraveledSince(since: Timestamp): Distance {
    const positions = this.positionHistory.filter(pos => pos.timestamp >= since);

    if (positions.length < 2) {
      return 0;
    }

    let totalDistance = 0;
    for (let i = 1; i < positions.length; i++) {
      const current = positions[i];
      const previous = positions[i - 1];
      if (current && previous) {
        totalDistance += current.distanceTo(previous);
      }
    }

    return totalDistance;
  }

  /**
   * Check if equipment has been active recently
   */
  isActiveRecently(withinMs: number = 300000): boolean {
    // 5 minutes default
    if (!this.lastPosition) {
      return false;
    }

    const age = Date.now() - this.lastPosition.timestamp.getTime();
    return age <= withinMs;
  }

  /**
   * Get equipment type display label
   */
  getTypeLabel(): string {
    return EquipmentTypeLabels[this.type];
  }

  /**
   * Get equipment status display label
   */
  getStatusLabel(): string {
    return EquipmentStatusLabels[this.status];
  }

  /**
   * Convert to plain object (for JSON serialization)
   */
  toJSON(): IEquipment {
    const result: IEquipment = {
      id: this.id,
      type: this.type,
      name: this.name,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };

    if (this.lastPosition) {
      result.lastPosition = this.lastPosition.toJSON();
    }

    return result;
  }

  /**
   * Format equipment as a human-readable string
   */
  toString(): string {
    const typeLabel = this.getTypeLabel();
    const statusLabel = this.getStatusLabel();
    const positionInfo = this.lastPosition
      ? ` at ${this.lastPosition.toDisplayString()}`
      : ' (no position)';

    return `Equipment(id=${this.id}, name="${this.name}", type=${typeLabel}, status=${statusLabel}${positionInfo})`;
  }

  /**
   * Create equipment summary for dashboards
   */
  getSummary(): {
    id: EquipmentId;
    name: string;
    type: string;
    status: string;
    lastSeen?: string;
    isMoving: boolean;
    currentSpeed?: Speed;
    positionCount: number;
  } {
    const summary: {
      id: EquipmentId;
      name: string;
      type: string;
      status: string;
      lastSeen?: string;
      isMoving: boolean;
      currentSpeed?: Speed;
      positionCount: number;
    } = {
      id: this.id,
      name: this.name,
      type: this.getTypeLabel(),
      status: this.getStatusLabel(),
      isMoving: this.isMoving(),
      positionCount: this.positionHistory.length,
    };

    if (this.lastPosition) {
      summary.lastSeen = this.lastPosition.timestamp.toISOString();
    }

    const currentSpeed = this.getCurrentSpeed();
    if (currentSpeed !== undefined) {
      summary.currentSpeed = currentSpeed;
    }

    return summary;
  }

  /**
   * Clone equipment (for testing or state management)
   */
  clone(): Equipment {
    const cloned = new Equipment({
      id: this.id,
      type: this.type,
      name: this.name,
      status: this.status,
    });

    // Copy position history
    cloned.positionHistory = [...this.positionHistory];
    if (this.lastPosition) {
      cloned.lastPosition = this.lastPosition;
    }

    // Copy timestamps
    (cloned as any).createdAt = this.createdAt;
    (cloned as any).updatedAt = this.updatedAt;

    return cloned;
  }
}

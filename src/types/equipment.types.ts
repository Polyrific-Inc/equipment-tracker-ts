/**
 * Equipment-related types and interfaces
 */

import type { EquipmentId, Timestamp } from './common.types.js';
import type { Position, PositionHistory } from './position.types.js';

// Equipment types enum (matches C++ EquipmentType)
export enum EquipmentType {
  Forklift = 'forklift',
  Crane = 'crane',
  Bulldozer = 'bulldozer',
  Excavator = 'excavator',
  Truck = 'truck',
  Other = 'other',
}

// Equipment status enum (matches C++ EquipmentStatus)
export enum EquipmentStatus {
  Active = 'active',
  Inactive = 'inactive',
  Maintenance = 'maintenance',
  Unknown = 'unknown',
}

// Core equipment interface
export interface IEquipment {
  readonly id: EquipmentId;
  readonly type: EquipmentType;
  name: string;
  status: EquipmentStatus;
  lastPosition?: Position;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

// Equipment creation data (for new equipment)
export interface CreateEquipmentData {
  readonly id: EquipmentId;
  readonly type: EquipmentType;
  readonly name: string;
  readonly status?: EquipmentStatus;
}

// Equipment update data (partial updates)
export interface UpdateEquipmentData {
  readonly name?: string;
  readonly status?: EquipmentStatus;
}

// Extended equipment with position history
export interface EquipmentWithHistory extends IEquipment {
  readonly positionHistory: PositionHistory;
  readonly isMoving: boolean;
  readonly lastMovementAt?: Timestamp;
}

// Equipment query filters
export interface EquipmentQueryFilter {
  type?: EquipmentType | EquipmentType[];
  status?: EquipmentStatus | EquipmentStatus[];
  createdAfter?: Timestamp;
  createdBefore?: Timestamp;
  updatedAfter?: Timestamp;
  updatedBefore?: Timestamp;
  hasPosition?: boolean;
  isMoving?: boolean;
}

// Equipment with geofence information
export interface GeofenceViolation {
  readonly equipmentId: EquipmentId;
  readonly violationType: 'entered' | 'exited';
  readonly geofenceId: string;
  readonly position: Position;
  readonly timestamp: Timestamp;
}

// Equipment alert types
export enum AlertType {
  GeofenceViolation = 'geofence_violation',
  MaintenanceRequired = 'maintenance_required',
  LowBattery = 'low_battery',
  ConnectionLost = 'connection_lost',
  SpeedLimit = 'speed_limit',
  UnauthorizedUse = 'unauthorized_use',
}

export interface EquipmentAlert {
  readonly id: string;
  readonly equipmentId: EquipmentId;
  readonly type: AlertType;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly message: string;
  readonly timestamp: Timestamp;
  readonly acknowledged: boolean;
  readonly acknowledgedBy?: string;
  readonly acknowledgedAt?: Timestamp;
  readonly metadata?: Record<string, unknown>;
}

// Equipment statistics
export interface EquipmentStats {
  readonly equipmentId: EquipmentId;
  readonly totalDistance: number; // in meters
  readonly totalOperatingTime: number; // in seconds
  readonly averageSpeed: number; // in m/s
  readonly maxSpeed: number; // in m/s
  readonly lastActiveAt?: Timestamp;
  readonly maintenanceDue: boolean;
  readonly nextMaintenanceAt?: Timestamp;
}

// Fleet summary statistics
export interface FleetStats {
  readonly totalEquipment: number;
  readonly activeEquipment: number;
  readonly inactiveEquipment: number;
  readonly maintenanceEquipment: number;
  readonly unknownEquipment: number;
  readonly totalDistance: number;
  readonly totalOperatingTime: number;
  readonly averageUtilization: number; // percentage
  readonly lastUpdated: Timestamp;
}

// Type guards for equipment types
export const isValidEquipmentType = (value: unknown): value is EquipmentType => {
  return typeof value === 'string' && Object.values(EquipmentType).includes(value as EquipmentType);
};

export const isValidEquipmentStatus = (value: unknown): value is EquipmentStatus => {
  return (
    typeof value === 'string' && Object.values(EquipmentStatus).includes(value as EquipmentStatus)
  );
};

export const isValidAlertType = (value: unknown): value is AlertType => {
  return typeof value === 'string' && Object.values(AlertType).includes(value as AlertType);
};

// Equipment type display names
export const EquipmentTypeLabels: Record<EquipmentType, string> = {
  [EquipmentType.Forklift]: 'Forklift',
  [EquipmentType.Crane]: 'Crane',
  [EquipmentType.Bulldozer]: 'Bulldozer',
  [EquipmentType.Excavator]: 'Excavator',
  [EquipmentType.Truck]: 'Truck',
  [EquipmentType.Other]: 'Other',
};

// Equipment status display names and colors
export const EquipmentStatusLabels: Record<EquipmentStatus, string> = {
  [EquipmentStatus.Active]: 'Active',
  [EquipmentStatus.Inactive]: 'Inactive',
  [EquipmentStatus.Maintenance]: 'Maintenance',
  [EquipmentStatus.Unknown]: 'Unknown',
};

export const EquipmentStatusColors: Record<EquipmentStatus, string> = {
  [EquipmentStatus.Active]: '#10B981', // green
  [EquipmentStatus.Inactive]: '#6B7280', // gray
  [EquipmentStatus.Maintenance]: '#F59E0B', // yellow
  [EquipmentStatus.Unknown]: '#EF4444', // red
};

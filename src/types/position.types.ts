/**
 * Position and GPS-related types and interfaces
 */

import type {
  Latitude,
  Longitude,
  Altitude,
  Accuracy,
  Timestamp,
  Distance,
  Speed,
  EquipmentId,
  TimeRange,
  GeographicBounds,
} from './common.types.js';

// Core position interface (matches C++ Position class)
export interface Position {
  distanceTo(lastPosition: Position): unknown;
  readonly latitude: Latitude;
  readonly longitude: Longitude;
  readonly altitude: Altitude;
  readonly accuracy: Accuracy;
  readonly timestamp: Timestamp;
}

// Position creation data
export interface CreatePositionData {
  latitude: Latitude;
  longitude: Longitude;
  altitude?: Altitude;
  accuracy?: Accuracy;
  timestamp?: Timestamp;
}

// Position with additional metadata
export interface PositionWithMetadata extends Position {
  readonly equipmentId: EquipmentId;
  readonly speed?: Speed;
  readonly heading?: number; // degrees (0-360)
  readonly satellites?: number;
  readonly source: PositionSource;
  readonly id?: string;
}

// Position source types
export enum PositionSource {
  GPS = 'gps',
  Network = 'network',
  Manual = 'manual',
  Simulation = 'simulation',
}

// Position history type
export type PositionHistory = readonly Position[];

// Position query filters
export interface PositionQueryFilter {
  equipmentId?: EquipmentId | EquipmentId[] | undefined;
  timeRange?: TimeRange;
  bounds?: GeographicBounds;
  minAccuracy?: Accuracy;
  maxAccuracy?: Accuracy;
  source?: PositionSource | PositionSource[];
  hasSpeed?: boolean;
  minSpeed?: Speed;
  maxSpeed?: Speed;
}

// GPS tracking configuration
export interface GpsTrackingConfig {
  readonly updateInterval: number; // milliseconds
  readonly minAccuracy: Accuracy; // meters
  readonly maxAge: number; // milliseconds
  readonly enableHighAccuracy: boolean;
  readonly timeout: number; // milliseconds
  readonly simulationMode: boolean;
}

// NMEA message types
export enum NmeaMessageType {
  GGA = 'GGA', // Global Positioning System Fix Data
  RMC = 'RMC', // Recommended Minimum Course
  GSA = 'GSA', // GPS DOP and active satellites
  GSV = 'GSV', // GPS Satellites in view
  VTG = 'VTG', // Track made good and Ground speed
}

// NMEA sentence data
export interface NmeaData {
  readonly type: NmeaMessageType;
  readonly raw: string;
  readonly checksum: string;
  readonly fields: readonly string[];
  readonly timestamp: Timestamp;
}

// Parsed GPS data from NMEA
export interface GpsData {
  readonly position?: Position;
  readonly speed?: Speed;
  readonly heading?: number;
  readonly satellites?: number;
  readonly dilutionOfPrecision?: number;
  readonly fixQuality?: GpsFixQuality;
  readonly timestamp: Timestamp;
}

// GPS fix quality
export enum GpsFixQuality {
  Invalid = 0,
  Standard = 1,
  Differential = 2,
  PPS = 3,
  RTK = 4,
  FloatRTK = 5,
  Estimated = 6,
  Manual = 7,
  Simulation = 8,
}

// Movement detection configuration
export interface MovementConfig {
  readonly speedThreshold: Speed; // m/s
  readonly distanceThreshold: Distance; // meters
  readonly timeThreshold: number; // milliseconds
  readonly minimumPositions: number;
}

// Movement analysis result
export interface MovementAnalysis {
  readonly isMoving: boolean;
  readonly currentSpeed?: Speed;
  readonly averageSpeed?: Speed;
  readonly maxSpeed?: Speed;
  readonly totalDistance: Distance;
  readonly movingTime: number; // milliseconds
  readonly stoppedTime: number; // milliseconds
  readonly lastMovementAt?: Timestamp;
}

// Geofence types
export enum GeofenceType {
  Circle = 'circle',
  Polygon = 'polygon',
  Rectangle = 'rectangle',
}

// Base geofence interface
export interface BaseGeofence {
  readonly id: string;
  readonly name: string;
  readonly type: GeofenceType;
  readonly active: boolean;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

// Circular geofence
export interface CircularGeofence extends BaseGeofence {
  readonly type: GeofenceType.Circle;
  readonly center: {
    readonly latitude: Latitude;
    readonly longitude: Longitude;
  };
  readonly radius: Distance; // meters
}

// Rectangular geofence
export interface RectangularGeofence extends BaseGeofence {
  readonly type: GeofenceType.Rectangle;
  readonly bounds: GeographicBounds;
}

// Polygon geofence
export interface PolygonGeofence extends BaseGeofence {
  readonly type: GeofenceType.Polygon;
  readonly vertices: readonly {
    readonly latitude: Latitude;
    readonly longitude: Longitude;
  }[];
}

// Union type for all geofence types
export type Geofence = CircularGeofence | RectangularGeofence | PolygonGeofence;

// Position validation result
export interface PositionValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

// Distance calculation result
export interface DistanceCalculation {
  readonly distance: Distance;
  readonly bearing: number; // degrees
  readonly method: 'haversine' | 'vincenty' | 'euclidean';
}

// Type guards for position types
export const isValidPosition = (value: unknown): value is Position => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const pos = value as Record<string, unknown>;
  return (
    typeof pos.latitude === 'number' &&
    typeof pos.longitude === 'number' &&
    typeof pos.altitude === 'number' &&
    typeof pos.accuracy === 'number' &&
    pos.timestamp instanceof Date &&
    pos.latitude >= -90 &&
    pos.latitude <= 90 &&
    pos.longitude >= -180 &&
    pos.longitude <= 180 &&
    !Number.isNaN(pos.latitude) &&
    !Number.isNaN(pos.longitude) &&
    !Number.isNaN(pos.altitude) &&
    !Number.isNaN(pos.accuracy)
  );
};

export const isValidPositionSource = (value: unknown): value is PositionSource => {
  return (
    typeof value === 'string' && Object.values(PositionSource).includes(value as PositionSource)
  );
};

export const isValidNmeaMessageType = (value: unknown): value is NmeaMessageType => {
  return (
    typeof value === 'string' && Object.values(NmeaMessageType).includes(value as NmeaMessageType)
  );
};

export const isValidGpsFixQuality = (value: unknown): value is GpsFixQuality => {
  return typeof value === 'number' && Object.values(GpsFixQuality).includes(value);
};

// Position source display names
export const PositionSourceLabels: Record<PositionSource, string> = {
  [PositionSource.GPS]: 'GPS',
  [PositionSource.Network]: 'Network',
  [PositionSource.Manual]: 'Manual',
  [PositionSource.Simulation]: 'Simulation',
};

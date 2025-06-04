/**
 * Common types and utilities used throughout the application
 */

// Base ID types for type safety
export type EquipmentId = string;
export type UserId = string;
export type SessionId = string;

// Timestamp type (using Date for JavaScript compatibility)
export type Timestamp = Date;

// Coordinate types with validation constraints
export type Latitude = number; // Range: -90 to 90
export type Longitude = number; // Range: -180 to 180
export type Altitude = number; // In meters
export type Accuracy = number; // In meters

// Distance and speed types
export type Distance = number; // In meters
export type Speed = number; // In meters per second

// Callback function types
export type PositionCallback = (
  latitude: Latitude,
  longitude: Longitude,
  altitude: Altitude,
  timestamp: Timestamp,
) => void;

export type CommandCallback = (command: string) => void;

export type ErrorCallback = (error: Error) => void;

// Configuration types
export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly ssl: boolean;
  readonly maxConnections: number;
  readonly connectionTimeout: number;
}

export interface GpsConfig {
  readonly serialPort: string;
  readonly baudRate: number;
  readonly updateIntervalMs: number;
  readonly simulationMode: boolean;
  readonly defaultAccuracy: Accuracy;
}

export interface NetworkConfig {
  readonly serverUrl: string;
  readonly serverPort: number;
  readonly timeout: number;
  readonly retryAttempts: number;
  readonly retryDelayMs: number;
}

export interface AppConfig {
  readonly environment: 'development' | 'production' | 'test';
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
  readonly port: number;
  readonly database: DatabaseConfig;
  readonly gps: GpsConfig;
  readonly network: NetworkConfig;
}

// Utility types for API responses
export interface ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly timestamp: Timestamp;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
    readonly hasNext: boolean;
    readonly hasPrev: boolean;
  };
}

// Event types for the event system
export interface BaseEvent {
  readonly id: string;
  readonly type: string;
  readonly timestamp: Timestamp;
  readonly source: string;
}

// Validation result types
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
}

// Time range for queries
export interface TimeRange {
  start: Timestamp;
  end: Timestamp;
}

// Geographic bounds for area queries
export interface GeographicBounds {
  northEast: {
    lat: Latitude;
    lng: Longitude;
  };
  southWest: {
    lat: Latitude;
    lng: Longitude;
  };
}

// Constants (equivalent to C++ constants)
export const Constants = {
  DEFAULT_UPDATE_INTERVAL_MS: 5000,
  DEFAULT_CONNECTION_TIMEOUT_MS: 10000,
  DEFAULT_POSITION_ACCURACY: 2.5,
  DEFAULT_MAX_HISTORY_SIZE: 100,
  EARTH_RADIUS_METERS: 6371000.0,
  MOVEMENT_SPEED_THRESHOLD: 0.5,
  DEFAULT_SERVER_PORT: 8080,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
} as const;

// Type guards for runtime type checking
export const isValidLatitude = (value: unknown): value is Latitude => {
  return typeof value === 'number' && value >= -90 && value <= 90 && !Number.isNaN(value);
};

export const isValidLongitude = (value: unknown): value is Longitude => {
  return typeof value === 'number' && value >= -180 && value <= 180 && !Number.isNaN(value);
};

export const isValidTimestamp = (value: unknown): value is Timestamp => {
  return value instanceof Date && !Number.isNaN(value.getTime());
};

export const isValidEquipmentId = (value: unknown): value is EquipmentId => {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
};

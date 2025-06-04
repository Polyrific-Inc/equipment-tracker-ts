/**
 * Central export file for all types
 *
 * This file exports all types from the types directory,
 * making it easy to import them throughout the application.
 */

// Common types and utilities
export type {
  EquipmentId,
  UserId,
  SessionId,
  Timestamp,
  Latitude,
  Longitude,
  Altitude,
  Accuracy,
  Distance,
  Speed,
  PositionCallback,
  CommandCallback,
  ErrorCallback,
  DatabaseConfig,
  GpsConfig,
  NetworkConfig,
  AppConfig,
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
  BaseEvent,
  ValidationResult,
  TimeRange,
  GeographicBounds,
} from './common.types.js';

export {
  Constants,
  isValidLatitude,
  isValidLongitude,
  isValidTimestamp,
  isValidEquipmentId,
} from './common.types.js';

// Equipment types
export { EquipmentType, EquipmentStatus, AlertType } from './equipment.types.js';

export type {
  IEquipment,
  CreateEquipmentData,
  UpdateEquipmentData,
  EquipmentWithHistory,
  EquipmentQueryFilter,
  GeofenceViolation,
  EquipmentAlert,
  EquipmentStats,
  FleetStats,
} from './equipment.types.js';

export {
  isValidEquipmentType,
  isValidEquipmentStatus,
  isValidAlertType,
  EquipmentTypeLabels,
  EquipmentStatusLabels,
  EquipmentStatusColors,
} from './equipment.types.js';

// Position types
export { PositionSource, NmeaMessageType, GpsFixQuality, GeofenceType } from './position.types.js';

export type {
  Position,
  CreatePositionData,
  PositionWithMetadata,
  PositionHistory,
  PositionQueryFilter,
  GpsTrackingConfig,
  NmeaData,
  GpsData,
  MovementConfig,
  MovementAnalysis,
  BaseGeofence,
  CircularGeofence,
  RectangularGeofence,
  PolygonGeofence,
  Geofence,
  PositionValidationResult,
  DistanceCalculation,
} from './position.types.js';

export {
  isValidPosition,
  isValidPositionSource,
  isValidNmeaMessageType,
  isValidGpsFixQuality,
  PositionSourceLabels,
} from './position.types.js';

// API types
export { WebSocketMessageType } from './api.types.js';

export type {
  AuthenticatedRequest,
  TypedResponse,
  WebSocketMessage,
  WebSocketClient,
  HttpError,
  RouteHandler,
  Middleware,
  AuthMiddleware,
  ValidationMiddleware,
  RateLimitConfig,
  // Query parameter types
  EquipmentQueryParams,
  PositionQueryParams,
  PaginationQueryParams,
  TimeRangeQueryParams,
  // Namespace exports
  EquipmentAPI,
  PositionAPI,
  FleetAPI,
  GeofenceAPI,
} from './api.types.js';

// Re-export specific message types that are commonly used
export type {
  SubscribeMessage,
  PositionUpdateMessage,
  EquipmentUpdateMessage,
  AlertMessage,
  CommandMessage,
  ErrorMessage,
} from './api.types.js';

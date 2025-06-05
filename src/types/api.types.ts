// Update to api.types.ts - Add missing properties to AuthenticatedRequest

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * API-related types and interfaces for HTTP endpoints and WebSocket communication
 */

import type { Request, Response } from 'express';
import type {
  EquipmentId,
  Timestamp,
  ApiResponse,
  PaginatedResponse,
  GeographicBounds,
} from './common.types.js';
import type {
  IEquipment,
  CreateEquipmentData,
  UpdateEquipmentData,
  EquipmentAlert,
  FleetStats,
} from './equipment.types.js';
import type {
  BasePosition, // Use BasePosition for API responses
  PositionWithMetadata,
  CreatePositionData,
  MovementAnalysis,
  Geofence,
} from './position.types.js';

// Extended Express types with additional logging properties
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  // Add missing properties used by logging middleware
  requestId?: string;
  traceId?: string;
}

export interface TypedResponse<T> extends Response {
  json: (body: ApiResponse<T>) => this;
}

// Query parameter types (all string-based as they come from URL)
export interface EquipmentQueryParams {
  readonly type?: string; // comma-separated EquipmentType values
  readonly status?: string; // comma-separated EquipmentStatus values
  readonly createdAfter?: string; // ISO date string
  readonly createdBefore?: string; // ISO date string
  readonly updatedAfter?: string; // ISO date string
  readonly updatedBefore?: string; // ISO date string
  readonly hasPosition?: string; // 'true' | 'false'
  readonly isMoving?: string; // 'true' | 'false'
}

export interface PositionQueryParams {
  readonly equipmentId?: string; // comma-separated EquipmentId values
  readonly startTime?: string; // ISO date string
  readonly endTime?: string; // ISO date string
  readonly minLat?: string; // number as string
  readonly maxLat?: string; // number as string
  readonly minLng?: string; // number as string
  readonly maxLng?: string; // number as string
  readonly minAccuracy?: string; // number as string
  readonly maxAccuracy?: string; // number as string
  readonly source?: string; // comma-separated PositionSource values
  readonly hasSpeed?: string; // 'true' | 'false'
  readonly minSpeed?: string; // number as string
  readonly maxSpeed?: string; // number as string
}

export interface PaginationQueryParams {
  readonly page?: string; // number as string
  readonly limit?: string; // number as string
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
}

export interface TimeRangeQueryParams {
  readonly start?: string; // ISO date string
  readonly end?: string; // ISO date string
}

// Equipment API endpoints
export namespace EquipmentAPI {
  // GET /api/equipment
  export interface ListRequest extends Request {
    query: Partial<EquipmentQueryParams & PaginationQueryParams>;
  }
  export type ListResponse = TypedResponse<PaginatedResponse<IEquipment>>;

  // GET /api/equipment/:id
  export interface GetRequest extends Request {
    params: { id: EquipmentId };
  }
  export type GetResponse = TypedResponse<IEquipment>;

  // POST /api/equipment
  export interface CreateRequest extends Request {
    body: CreateEquipmentData;
  }
  export type CreateResponse = TypedResponse<IEquipment>;

  // PUT /api/equipment/:id
  export interface UpdateRequest extends Request {
    params: { id: EquipmentId };
    body: UpdateEquipmentData;
  }
  export type UpdateResponse = TypedResponse<IEquipment>;

  // DELETE /api/equipment/:id
  export interface DeleteRequest extends Request {
    params: { id: EquipmentId };
  }
  export type DeleteResponse = TypedResponse<{ deleted: boolean }>;

  // GET /api/equipment/:id/positions
  export interface GetPositionsRequest extends Request {
    params: { id: EquipmentId };
    query: Partial<PositionQueryParams & PaginationQueryParams>;
  }
  export type GetPositionsResponse = TypedResponse<PaginatedResponse<BasePosition>>; // Use BasePosition for API

  // POST /api/equipment/:id/positions
  export interface CreatePositionRequest extends Request {
    params: { id: EquipmentId };
    body: CreatePositionData;
  }
  export type CreatePositionResponse = TypedResponse<BasePosition>; // Use BasePosition for API response

  // GET /api/equipment/:id/movement
  export interface GetMovementRequest extends Request {
    params: { id: EquipmentId };
    query: Partial<TimeRangeQueryParams>;
  }
  export type GetMovementResponse = TypedResponse<MovementAnalysis>;
}

// Position API endpoints
export namespace PositionAPI {
  // GET /api/positions
  export interface ListRequest extends Request {
    query: Partial<PositionQueryParams & PaginationQueryParams>;
  }
  export type ListResponse = TypedResponse<PaginatedResponse<PositionWithMetadata>>;

  // POST /api/positions/bulk
  export interface BulkCreateRequest extends Request {
    body: {
      positions: (CreatePositionData & { equipmentId: EquipmentId })[];
    };
  }
  export type BulkCreateResponse = TypedResponse<{ created: number; errors: string[] }>;

  // GET /api/positions/live
  export interface LiveRequest extends Request {
    query: {
      equipmentIds?: string; // comma-separated
      bounds?: string; // JSON encoded GeographicBounds
    };
  }
  export type LiveResponse = TypedResponse<PositionWithMetadata[]>;
}

// Fleet management API
export namespace FleetAPI {
  // GET /api/fleet/stats
  export interface StatsRequest extends Request {
    query: Partial<TimeRangeQueryParams>;
  }
  export type StatsResponse = TypedResponse<FleetStats>;

  // GET /api/fleet/alerts
  export interface AlertsRequest extends Request {
    query: Partial<
      {
        equipmentId: string;
        acknowledged: string; // 'true' | 'false'
        severity: string;
      } & PaginationQueryParams
    >;
  }
  export type AlertsResponse = TypedResponse<PaginatedResponse<EquipmentAlert>>;

  // POST /api/fleet/alerts/:id/acknowledge
  export interface AcknowledgeAlertRequest extends Request {
    params: { id: string };
    body: { acknowledgedBy: string };
  }
  export type AcknowledgeAlertResponse = TypedResponse<EquipmentAlert>;
}

// Geofence API
export namespace GeofenceAPI {
  // GET /api/geofences
  export interface ListRequest extends Request {
    query: Partial<PaginationQueryParams>;
  }
  export type ListResponse = TypedResponse<PaginatedResponse<Geofence>>;

  // POST /api/geofences
  export interface CreateRequest extends Request {
    body: Omit<Geofence, 'id' | 'createdAt' | 'updatedAt'>;
  }
  export type CreateResponse = TypedResponse<Geofence>;

  // PUT /api/geofences/:id
  export interface UpdateRequest extends Request {
    params: { id: string };
    body: Partial<Omit<Geofence, 'id' | 'createdAt' | 'updatedAt'>>;
  }
  export type UpdateResponse = TypedResponse<Geofence>;

  // DELETE /api/geofences/:id
  export interface DeleteRequest extends Request {
    params: { id: string };
  }
  export type DeleteResponse = TypedResponse<{ deleted: boolean }>;

  // GET /api/geofences/:id/violations
  export interface GetViolationsRequest extends Request {
    params: { id: string };
    query: Partial<TimeRangeQueryParams & PaginationQueryParams>;
  }
  export type GetViolationsResponse = TypedResponse<PaginatedResponse<any>>; // GeofenceViolation
}

// WebSocket message types
export enum WebSocketMessageType {
  // Client -> Server
  Subscribe = 'subscribe',
  Unsubscribe = 'unsubscribe',
  Ping = 'ping',
  Command = 'command',

  // Server -> Client
  PositionUpdate = 'position_update',
  EquipmentUpdate = 'equipment_update',
  Alert = 'alert',
  GeofenceViolation = 'geofence_violation',
  Pong = 'pong',
  Error = 'error',
  Connected = 'connected',
  Disconnected = 'disconnected',
}

// Base WebSocket message
export interface BaseWebSocketMessage {
  readonly type: WebSocketMessageType;
  readonly timestamp: Timestamp;
  readonly id: string;
}

// Client subscription message
export interface SubscribeMessage extends BaseWebSocketMessage {
  readonly type: WebSocketMessageType.Subscribe;
  readonly payload: {
    readonly equipmentIds?: EquipmentId[];
    readonly bounds?: GeographicBounds;
    readonly alerts?: boolean;
  };
}

// Position update message (server -> client)
export interface PositionUpdateMessage extends BaseWebSocketMessage {
  readonly type: WebSocketMessageType.PositionUpdate;
  readonly payload: PositionWithMetadata;
}

// Equipment update message (server -> client)
export interface EquipmentUpdateMessage extends BaseWebSocketMessage {
  readonly type: WebSocketMessageType.EquipmentUpdate;
  readonly payload: IEquipment;
}

// Alert message (server -> client)
export interface AlertMessage extends BaseWebSocketMessage {
  readonly type: WebSocketMessageType.Alert;
  readonly payload: EquipmentAlert;
}

// Command message (client -> server)
export interface CommandMessage extends BaseWebSocketMessage {
  readonly type: WebSocketMessageType.Command;
  readonly payload: {
    readonly equipmentId: EquipmentId;
    readonly command: string;
    readonly parameters?: Record<string, unknown>;
  };
}

// Error message (server -> client)
export interface ErrorMessage extends BaseWebSocketMessage {
  readonly type: WebSocketMessageType.Error;
  readonly payload: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
}

// Union type of all WebSocket messages
export type WebSocketMessage =
  | SubscribeMessage
  | PositionUpdateMessage
  | EquipmentUpdateMessage
  | AlertMessage
  | CommandMessage
  | ErrorMessage
  | BaseWebSocketMessage;

// WebSocket client interface
export interface WebSocketClient {
  readonly id: string;
  readonly connectedAt: Timestamp;
  readonly subscriptions: {
    readonly equipmentIds: Set<EquipmentId>;
    readonly bounds?: GeographicBounds;
    readonly alerts: boolean;
  };
  send(message: WebSocketMessage): void;
  close(): void;
}

// HTTP error types
export interface HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
}

// API route handler types
export type RouteHandler<TReq = Request, TRes = Response> = (
  req: TReq,
  res: TRes,
  next: (error?: unknown) => void,
) => void | Promise<void>;

// Middleware types
export type Middleware<TReq = Request, TRes = Response> = (
  req: TReq,
  res: TRes,
  next: (error?: unknown) => void,
) => void | Promise<void>;

// Authentication middleware
export type AuthMiddleware = Middleware<AuthenticatedRequest>;

// Validation middleware
export type ValidationMiddleware<T = unknown> = Middleware<Request & { validatedBody: T }>;

// Rate limiting configuration
export interface RateLimitConfig {
  readonly windowMs: number;
  readonly maxRequests: number;
  readonly skipSuccessfulRequests: boolean;
  readonly skipFailedRequests: boolean;
  readonly message?: string;
}

/**
 * Middleware Index - Central export for all middleware components
 */

// Error handling middleware
export {
  AppError,
  createError,
  errorHandler,
  notFoundHandler,
  catchAsync,
} from './error.middleware.js';

// Authentication and authorization middleware
export {
  UserRole,
  Permission,
  authenticate,
  optionalAuthenticate,
  requirePermission,
  requireRole,
  requireAnyRole,
  requireAdmin,
  requireOperator,
  requireAuth,
  requireSystemAuth,
  requireResourceOwnership,
  validateWebhookSignature,
  createUserRateLimit,
  auditLog,
} from './auth.middleware.js';

// Validation middleware
export {
  validate,
  validateEquipment,
  validatePosition,
  validateGeofence,
  validateFleet,
  customValidation,
  equipmentSchemas,
  positionSchemas,
  geofenceSchemas,
  fleetSchemas,
} from './validation.middleware.js';

// Rate limiting middleware
export {
  rateLimitConfigs,
  createRateLimit,
  createDynamicRateLimit,
  endpointRateLimit,
  createProgressiveRateLimit,
  createSlidingWindowRateLimit,
  createTokenBucketRateLimit,
  cleanupRateLimitStores,
} from './rate-limit.middleware.js';

// Logging and monitoring middleware
export {
  LogLevel,
  logger,
  requestLogger,
  errorLogger,
  performanceMonitor,
  securityHeaders,
  corsWithLogging,
  healthCheck,
  requestTimeout,
  requestSizeLimit,
  apiVersioning,
  requestTracing,
  compressionInfo,
  getMetrics,
  getRecentLogs,
  clearMetrics,
  metricsCollector,
  loggingMiddleware,
  developmentMiddleware,
  productionMiddleware,
} from './logging.middleware.js';

// Common middleware combinations for different environments
export const commonMiddleware = {
  // Basic middleware for all requests
  basic: ['requestTracing', 'securityHeaders', 'corsWithLogging'],

  // API middleware with authentication
  api: [
    'requestTracing',
    'requestLogger',
    'securityHeaders',
    'corsWithLogging',
    'authenticate',
    'performanceMonitor',
  ],

  // Public API middleware (no auth required)
  publicApi: [
    'requestTracing',
    'requestLogger',
    'securityHeaders',
    'corsWithLogging',
    'optionalAuthenticate',
    'performanceMonitor',
  ],

  // Admin-only middleware
  admin: [
    'requestTracing',
    'requestLogger',
    'securityHeaders',
    'authenticate',
    'requireAdmin',
    'auditLog',
    'performanceMonitor',
  ],

  // High-security middleware for sensitive operations
  sensitive: [
    'requestTracing',
    'requestLogger',
    'securityHeaders',
    'authenticate',
    'requirePermission',
    'auditLog',
    'endpointRateLimit.strict',
    'performanceMonitor',
  ],
};

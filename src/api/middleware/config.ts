/* eslint-disable max-lines-per-function */
/**
 * Middleware Configuration
 * Example configuration showing how to use all middleware components
 */

import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import {
  // Error handling
  errorHandler,
  notFoundHandler,

  // Authentication
  authenticate,
  requireAdmin,
  requireOperator,
  requirePermission,
  Permission,

  // Validation
  validateEquipment,
  validatePosition,
  validateGeofence,
  validateFleet,

  // Rate limiting
  endpointRateLimit,
  errorLogger,
  performanceMonitor,
  corsWithLogging,
  requestTimeout,
  requestSizeLimit,
  healthCheck,
  getMetrics,
  getRecentLogs,
  clearMetrics,

  // Development vs Production
  developmentMiddleware,
  productionMiddleware,
} from './index.js';

/**
 * Configure middleware for Express app
 */
export const configureMiddleware = (app: express.Application): void => {
  // Basic Express middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression());

  // Security middleware (using Helmet for additional security)
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false, // Allow embedding for dashboards
      contentSecurityPolicy: false, // Disable CSP for API
    }),
  );

  // Environment-specific middleware
  if (process.env.NODE_ENV === 'production') {
    app.use(productionMiddleware);
  } else {
    app.use(developmentMiddleware);
  }

  // Global rate limiting
  app.use('/api', (req, res, next) => {
    Promise.resolve(endpointRateLimit.standard(req, res, next)).catch(next);
  });
};

/**
 * Configure API routes with appropriate middleware
 */
export const configureApiRoutes = (app: express.Application): void => {
  // Health and monitoring endpoints (no auth required)
  app.get('/health', healthCheck);
  app.get('/api/health', healthCheck);

  // Metrics endpoints (admin only)
  app.get('/metrics', authenticate, requireAdmin, getMetrics);

  app.get('/api/metrics', authenticate, requireAdmin, getMetrics);

  app.get('/api/logs', authenticate, requireAdmin, getRecentLogs);

  app.delete('/api/metrics', authenticate, requireAdmin, clearMetrics);

  // Equipment routes with validation and rate limiting
  app.get(
    '/api/equipment',
    authenticate,
    validateEquipment.list,
    (req, res, next) => {
      Promise.resolve(endpointRateLimit.dynamic(req, res, next)).catch(next);
    },
    // Equipment controller would go here
  );

  app.post(
    '/api/equipment',
    authenticate,
    requireOperator,
    validateEquipment.create,
    (req, res, next) => {
      Promise.resolve(endpointRateLimit.strict(req, res, next)).catch(next);
    },
    // Equipment creation controller
  );

  app.put(
    '/api/equipment/:id',
    authenticate,
    requireOperator,
    validateEquipment.update,
    (req, res, next) => {
      Promise.resolve(endpointRateLimit.strict(req, res, next)).catch(next);
    },
    // Equipment update controller
  );

  app.delete(
    '/api/equipment/:id',
    authenticate,
    requireAdmin,
    validateEquipment.getById,
    (req, res, next) => {
      Promise.resolve(endpointRateLimit.strict(req, res, next)).catch(next);
    },
    // Equipment deletion controller
  );

  // Position routes with bulk operation limits
  app.get(
    '/api/positions',
    authenticate,
    validatePosition.list,
    (req, res, next) => {
      Promise.resolve(endpointRateLimit.dynamic(req, res, next)).catch(next);
    },
    // Position list controller
  );

  app.post(
    '/api/positions/bulk',
    authenticate,
    requireOperator,
    validatePosition.bulkCreate,
    (req, res, next) => {
      Promise.resolve(endpointRateLimit.bulk(req, res, next)).catch(next);
    },
    requestTimeout(60000), // 60 second timeout for bulk operations
    // Bulk position creation controller
  );

  // Geofence routes with admin permissions
  app.post(
    '/api/geofences',
    authenticate,
    requireAdmin,
    validateGeofence.create,
    (req, res, next) => {
      Promise.resolve(endpointRateLimit.strict(req, res, next)).catch(next);
    },
    // Geofence creation controller
  );

  app.put(
    '/api/geofences/:id',
    authenticate,
    requireAdmin,
    validateGeofence.update,
    (req, res, next) => {
      Promise.resolve(endpointRateLimit.strict(req, res, next)).catch(next);
    },
    // Geofence update controller
  );

  app.delete(
    '/api/geofences/:id',
    authenticate,
    requireAdmin,
    validateGeofence.getById,
    (req, res, next) => {
      Promise.resolve(endpointRateLimit.strict(req, res, next)).catch(next);
    },
    // Geofence deletion controller
  );

  // Fleet management routes
  app.get(
    '/api/fleet/stats',
    authenticate,
    validateFleet.stats,
    (req, res, next) => {
      Promise.resolve(endpointRateLimit.dynamic(req, res, next)).catch(next);
    },
    // Fleet stats controller
  );

  app.post(
    '/api/fleet/alerts/:id/acknowledge',
    authenticate,
    requireOperator,
    validateFleet.acknowledgeAlert,
    (req, res, next) => {
      Promise.resolve(endpointRateLimit.standard(req, res, next)).catch(next);
    },
    // Alert acknowledgment controller
  );

  // Sensitive operations with enhanced security
  app.post(
    '/api/fleet/simulation/start',
    authenticate,
    requireAdmin,
    (req, res, next) => {
      Promise.resolve(endpointRateLimit.strict(req, res, next)).catch(next);
    },
    requestTimeout(10000),
    // Simulation start controller
  );

  app.delete(
    '/api/positions/cleanup',
    authenticate,
    requireAdmin,
    (req, res, next) => {
      Promise.resolve(endpointRateLimit.strict(req, res, next)).catch(next);
    },
    requestTimeout(120000), // 2 minute timeout for cleanup
    // Position cleanup controller
  );
};

/**
 * Configure error handling (must be last)
 */
export const configureErrorHandling = (app: express.Application): void => {
  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Error logging middleware
  app.use(errorLogger);

  // Global error handler (must be last middleware)
  app.use(errorHandler);
};

/**
 * Route-specific middleware configurations
 */
export const routeMiddleware = {
  // Public routes (no authentication)
  public: [corsWithLogging, endpointRateLimit.standard],

  // Authenticated routes
  authenticated: [authenticate, corsWithLogging, endpointRateLimit.dynamic, performanceMonitor],

  // Admin-only routes
  admin: [
    authenticate,
    requireAdmin,
    corsWithLogging,
    endpointRateLimit.strict,
    performanceMonitor,
  ],

  // Operator routes (read/write access)
  operator: [
    authenticate,
    requireOperator,
    corsWithLogging,
    endpointRateLimit.dynamic,
    performanceMonitor,
  ],

  // Bulk operation routes
  bulk: [
    authenticate,
    requireOperator,
    corsWithLogging,
    endpointRateLimit.bulk,
    requestTimeout(60000),
    requestSizeLimit(50 * 1024 * 1024), // 50MB for bulk operations
    performanceMonitor,
  ],

  // Sensitive operation routes
  sensitive: [
    authenticate,
    requirePermission(Permission.ADMIN),
    corsWithLogging,
    endpointRateLimit.strict,
    performanceMonitor,
  ],
};

/**
 * Development-specific configurations
 */
export const developmentConfig = {
  // Enable detailed logging
  enableDetailedLogging: true,

  // Disable some security restrictions for development
  relaxedSecurity: true,

  // Enable debug endpoints
  enableDebugEndpoints: (app: express.Application): void => {
    app.get('/debug/metrics', getMetrics);
    app.get('/debug/logs', getRecentLogs);
    app.post('/debug/clear-metrics', clearMetrics);
  },
};

/**
 * Production-specific configurations
 */
export const productionConfig = {
  // Enable strict security
  strictSecurity: true,

  // Enable request timeouts
  enableTimeouts: true,

  // Enable comprehensive rate limiting
  enableRateLimiting: true,

  // Disable debug endpoints
  disableDebugEndpoints: true,
};

/**
 * Example usage in main app file
 */
export const exampleUsage = `
import express from 'express';
import { configureMiddleware, configureApiRoutes, configureErrorHandling } from './middleware/config.js';
import { createApiRouter } from './routes/index.js';

const app = express();

// Configure middleware
configureMiddleware(app);

// Configure API routes with middleware
configureApiRoutes(app);

// Mount your API router
app.use('/api', createApiRouter({ appService }));

// Configure error handling (must be last)
configureErrorHandling(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-lines-per-function */
/**
 * Main API Router
 * Combines all route modules and provides the main API entry point
 */

import { Router } from 'express';
import { createEquipmentRoutes } from './equipment.routes.js';
import { createFleetRoutes } from './fleet.routes.js';
import { createPositionRoutes } from './position.routes.js';
import { createGeofenceRoutes } from './geofence.routes.js';
import { asyncHandler } from '../../infrastructure/utils/async-handler.js';
import type { AppService } from '../../services/app.service.js';

export interface ApiRouterDependencies {
  appService: AppService;
}

export const createApiRouter = (dependencies: ApiRouterDependencies): Router => {
  const { appService } = dependencies;
  const router = Router();

  // Get service instances
  const equipmentService = appService.getEquipmentService();
  const gpsTrackingService = appService.getGpsTrackingService();
  const alertService = appService.getAlertService();

  // We need to access repositories - they should be accessible through services
  // For now, we'll create a simplified version that uses services
  const positionRepository = (appService as any).positionRepository;

  // API health check endpoint
  router.get(
    '/health',
    asyncHandler(async (req, res) => {
      const health = await appService.getHealthStatus();
      res.json({
        success: true,
        data: health,
        timestamp: new Date(),
      });
    }),
  );

  // API info endpoint
  router.get('/info', (req, res) => {
    res.json({
      success: true,
      data: {
        name: 'Equipment Tracker API',
        version: '1.0.0',
        description: 'Fleet management and GPS tracking API',
        endpoints: {
          equipment: '/api/equipment',
          fleet: '/api/fleet',
          positions: '/api/positions',
          geofences: '/api/geofences',
        },
      },
      timestamp: new Date(),
    });
  });

  // Mount route modules
  router.use('/equipment', createEquipmentRoutes(equipmentService));
  router.use('/fleet', createFleetRoutes(equipmentService, alertService, appService));
  router.use(
    '/positions',
    createPositionRoutes(positionRepository, gpsTrackingService, appService),
  );
  router.use('/geofences', createGeofenceRoutes(alertService));

  // Catch-all route for unhandled API endpoints
  router.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
      timestamp: new Date(),
    });
  });

  return router;
};

// Export route creation functions for individual use
export { createEquipmentRoutes, createFleetRoutes, createPositionRoutes, createGeofenceRoutes };

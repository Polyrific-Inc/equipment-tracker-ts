/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable complexity */
/* eslint-disable max-lines-per-function */
/**
 * Geofence API Routes
 * Handles geofence management and violation tracking
 */

import { Router } from 'express';
import { asyncHandler } from '../../infrastructure/utils/async-handler.js';
import { Controllers } from '../controllers/index.js';
import {
  authenticate,
  requireAdmin,
  validateGeofence,
  endpointRateLimit,
} from '../middleware/index.js';

// Define proper geofence types to fix property access issues
interface CircularGeofenceData {
  name: string;
  type: 'circle';
  active: boolean;
  center: { latitude: number; longitude: number };
  radius: number;
}

interface RectangularGeofenceData {
  name: string;
  type: 'rectangle';
  active: boolean;
  bounds: {
    northEast: { lat: number; lng: number };
    southWest: { lat: number; lng: number };
  };
}

interface PolygonGeofenceData {
  name: string;
  type: 'polygon';
  active: boolean;
  vertices: Array<{ latitude: number; longitude: number }>;
}

type GeofenceCreateData = CircularGeofenceData | RectangularGeofenceData | PolygonGeofenceData;

export const createGeofenceRoutes = (controllers: Controllers): Router => {
  const router = Router();
  const { geofenceController } = controllers;

  // GET /api/geofences - List geofences
  router.get(
    '/',
    authenticate,
    validateGeofence.list,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(geofenceController.list),
  );

  // GET /api/geofences/active - Active geofences
  router.get(
    '/active',
    authenticate,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(geofenceController.getActive),
  );

  // GET /api/geofences/types - Geofence types
  router.get(
    '/types',
    authenticate,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(geofenceController.getTypes),
  );

  // GET /api/geofences/summary - Geofence summary
  router.get(
    '/summary',
    authenticate,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(geofenceController.getSummary),
  );

  // POST /api/geofences - Create geofence
  router.post(
    '/',
    authenticate,
    requireAdmin,
    validateGeofence.create,
    asyncHandler(endpointRateLimit.strict),
    asyncHandler(geofenceController.create),
  );

  // GET /api/geofences/:id - Get geofence
  router.get(
    '/:id',
    authenticate,
    validateGeofence.getById,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(geofenceController.getById),
  );

  // PUT /api/geofences/:id - Update geofence
  router.put(
    '/:id',
    authenticate,
    requireAdmin,
    validateGeofence.update,
    asyncHandler(endpointRateLimit.strict),
    asyncHandler(geofenceController.update),
  );

  // DELETE /api/geofences/:id - Delete geofence
  router.delete(
    '/:id',
    authenticate,
    requireAdmin,
    validateGeofence.getById,
    asyncHandler(endpointRateLimit.strict),
    asyncHandler(geofenceController.delete),
  );

  // POST /api/geofences/:id/activate - Activate geofence
  router.post(
    '/:id/activate',
    authenticate,
    requireAdmin,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(geofenceController.activate),
  );

  // POST /api/geofences/:id/deactivate - Deactivate geofence
  router.post(
    '/:id/deactivate',
    authenticate,
    requireAdmin,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(geofenceController.deactivate),
  );

  // GET /api/geofences/:id/violations - Get violations
  router.get(
    '/:id/violations',
    authenticate,
    validateGeofence.violations,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(geofenceController.getViolations),
  );

  // GET /api/geofences/violations/recent - Recent violations
  router.get(
    '/violations/recent',
    authenticate,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(geofenceController.getRecentViolations),
  );

  // GET /api/geofences/violations/stats - Violation statistics
  router.get(
    '/violations/stats',
    authenticate,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(geofenceController.getViolationStats),
  );

  // POST /api/geofences/test - Test position
  router.post(
    '/test',
    authenticate,
    validateGeofence.test,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(geofenceController.testPosition),
  );

  return router;
};

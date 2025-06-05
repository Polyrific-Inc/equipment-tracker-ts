/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-lines-per-function */
/**
 * Fleet Management API Routes
 * Handles fleet-wide operations, statistics, and alerts
 */

import { Router } from 'express';
import { asyncHandler } from '../../infrastructure/utils/async-handler.js';
import { Controllers } from '../controllers/index.js';
import {
  authenticate,
  requireAdmin,
  requireOperator,
  validateFleet,
  endpointRateLimit,
} from '../middleware/index.js';

export const createFleetRoutes = (controllers: Controllers): Router => {
  const router = Router();
  const { fleetController } = controllers;

  // GET /api/fleet/stats - Fleet statistics
  router.get(
    '/stats',
    authenticate,
    validateFleet.stats,
    asyncHandler(endpointRateLimit.dynamic),
    asyncHandler(fleetController.getStats),
  );

  // GET /api/fleet/dashboard - Dashboard data
  router.get(
    '/dashboard',
    authenticate,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(fleetController.getDashboard),
  );

  // GET /api/fleet/health - Fleet health
  router.get(
    '/health',
    authenticate,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(fleetController.getHealth),
  );

  // GET /api/fleet/overview - Comprehensive overview
  router.get(
    '/overview',
    authenticate,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(fleetController.getOverview),
  );

  // GET /api/fleet/alerts - Get alerts
  router.get(
    '/alerts',
    authenticate,
    validateFleet.alerts,
    asyncHandler(endpointRateLimit.dynamic),
    asyncHandler(fleetController.getAlerts),
  );

  // GET /api/fleet/alerts/unacknowledged - Unacknowledged alerts
  router.get(
    '/alerts/unacknowledged',
    authenticate,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(fleetController.getUnacknowledgedAlerts),
  );

  // POST /api/fleet/alerts/:id/acknowledge - Acknowledge alert
  router.post(
    '/alerts/:id/acknowledge',
    authenticate,
    requireOperator,
    validateFleet.acknowledgeAlert,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(fleetController.acknowledgeAlert),
  );

  // GET /api/fleet/alerts/stats - Alert statistics
  router.get(
    '/alerts/stats',
    authenticate,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(fleetController.getAlertStats),
  );

  // POST /api/fleet/simulation/start - Start simulation
  router.post(
    '/simulation/start',
    authenticate,
    requireAdmin,
    asyncHandler(endpointRateLimit.strict),
    asyncHandler(fleetController.startSimulation),
  );

  // POST /api/fleet/simulation/stop - Stop simulation
  router.post(
    '/simulation/stop',
    authenticate,
    requireAdmin,
    asyncHandler(endpointRateLimit.strict),
    asyncHandler(fleetController.stopSimulation),
  );

  // GET /api/fleet/statistics - Application statistics
  router.get(
    '/statistics',
    authenticate,
    requireOperator,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(fleetController.getApplicationStats),
  );

  // POST /api/fleet/tracking/start/:equipmentId - Start tracking
  router.post(
    '/tracking/start/:equipmentId',
    authenticate,
    requireOperator,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(fleetController.startTracking),
  );

  // POST /api/fleet/tracking/stop/:equipmentId - Stop tracking
  router.post(
    '/tracking/stop/:equipmentId',
    authenticate,
    requireOperator,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(fleetController.stopTracking),
  );

  // POST /api/fleet/maintenance/schedule - Schedule maintenance
  router.post(
    '/maintenance/schedule',
    authenticate,
    requireOperator,
    asyncHandler(endpointRateLimit.strict),
    asyncHandler(fleetController.scheduleMaintenance),
  );

  return router;
};

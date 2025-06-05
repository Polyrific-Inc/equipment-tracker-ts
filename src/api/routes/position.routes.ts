/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-lines-per-function */
/**
 * Position API Routes
 * Handles position data queries, bulk operations, and live feeds
 */

import { Router } from 'express';
import { asyncHandler } from '../../infrastructure/utils/async-handler.js';
import { Controllers } from '../controllers/index.js';
import {
  authenticate,
  requireAdmin,
  requireOperator,
  validatePosition,
  endpointRateLimit,
} from '../middleware/index.js';

export const createPositionRoutes = (controllers: Controllers): Router => {
  const router = Router();
  const { positionController } = controllers;

  // GET /api/positions - List positions
  router.get(
    '/',
    authenticate,
    validatePosition.list,
    asyncHandler(endpointRateLimit.dynamic),
    asyncHandler(positionController.list),
  );

  // GET /api/positions/latest - Latest positions
  router.get(
    '/latest',
    authenticate,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(positionController.getLatest),
  );

  // GET /api/positions/live - Live positions
  router.get(
    '/live',
    authenticate,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(positionController.getLive),
  );

  // POST /api/positions/bulk - Bulk create
  router.post(
    '/bulk',
    authenticate,
    requireOperator,
    validatePosition.bulkCreate,
    asyncHandler(endpointRateLimit.bulk),
    asyncHandler(positionController.bulkCreate),
  );

  // GET /api/positions/area - Positions in area
  router.get(
    '/area',
    authenticate,
    validatePosition.area,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(positionController.getInArea),
  );

  // GET /api/positions/near - Positions near point
  router.get(
    '/near',
    authenticate,
    validatePosition.near,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(positionController.getNear),
  );

  // GET /api/positions/accuracy - Positions by accuracy
  router.get(
    '/accuracy',
    authenticate,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(positionController.getByAccuracy),
  );

  // GET /api/positions/stats - Position statistics
  router.get(
    '/stats',
    authenticate,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(positionController.getStats),
  );

  // POST /api/positions/analyze - Analyze patterns
  router.post(
    '/analyze',
    authenticate,
    requireOperator,
    asyncHandler(endpointRateLimit.strict),
    asyncHandler(positionController.analyzePatterns),
  );

  // DELETE /api/positions/cleanup - Cleanup old positions
  router.delete(
    '/cleanup',
    authenticate,
    requireAdmin,
    asyncHandler(endpointRateLimit.strict),
    asyncHandler(positionController.cleanup),
  );

  return router;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-lines-per-function */
/**
 * Equipment API Routes
 * Handles CRUD operations for equipment and position management
 */

import { Router } from 'express';
import { asyncHandler } from '../../infrastructure/utils/async-handler.js';
import {
  authenticate,
  requireAdmin,
  requireOperator,
  validateEquipment,
  validatePosition,
  endpointRateLimit,
} from '../middleware/index.js';
import type { Controllers } from '../controllers/index.js';

export const createEquipmentRoutes = (controllers: Controllers): Router => {
  const router = Router();
  const { equipmentController } = controllers;

  // GET /api/equipment - List equipment with filtering and pagination
  router.get(
    '/',
    authenticate,
    validateEquipment.list,
    asyncHandler(endpointRateLimit.dynamic),
    asyncHandler(equipmentController.list),
  );

  // GET /api/equipment/active - Get active equipment
  router.get(
    '/active',
    authenticate,
    asyncHandler(endpointRateLimit.dynamic),
    asyncHandler(equipmentController.getActive),
  );

  // GET /api/equipment/maintenance - Get equipment due for maintenance
  router.get(
    '/maintenance',
    authenticate,
    requireOperator,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(equipmentController.getMaintenanceDue),
  );

  // GET /api/equipment/inactive - Get inactive equipment
  router.get(
    '/inactive',
    authenticate,
    requireOperator,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(equipmentController.getInactive),
  );

  // GET /api/equipment/:id - Get specific equipment
  router.get(
    '/:id',
    authenticate,
    validateEquipment.getById,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(equipmentController.getById),
  );

  // POST /api/equipment - Create new equipment
  router.post(
    '/',
    authenticate,
    requireOperator,
    validateEquipment.create,
    asyncHandler(endpointRateLimit.strict),
    asyncHandler(equipmentController.create),
  );

  // PUT /api/equipment/:id - Update equipment
  router.put(
    '/:id',
    authenticate,
    requireOperator,
    validateEquipment.update,
    asyncHandler(endpointRateLimit.strict),
    asyncHandler(equipmentController.update),
  );

  // DELETE /api/equipment/:id - Delete equipment
  router.delete(
    '/:id',
    authenticate,
    requireAdmin,
    validateEquipment.getById,
    asyncHandler(endpointRateLimit.strict),
    asyncHandler(equipmentController.delete),
  );

  // GET /api/equipment/:id/health - Check equipment health
  router.get(
    '/:id/health',
    authenticate,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(equipmentController.checkHealth),
  );

  // GET /api/equipment/:id/positions - Get equipment positions
  router.get(
    '/:id/positions',
    authenticate,
    asyncHandler(endpointRateLimit.dynamic),
    asyncHandler(equipmentController.getPositions),
  );

  // POST /api/equipment/:id/positions - Add position to equipment
  router.post(
    '/:id/positions',
    authenticate,
    requireOperator,
    validatePosition.create,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(equipmentController.addPosition),
  );

  // GET /api/equipment/:id/movement - Get movement analysis
  router.get(
    '/:id/movement',
    authenticate,
    asyncHandler(endpointRateLimit.standard),
    asyncHandler(equipmentController.getMovementAnalysis),
  );

  return router;
};

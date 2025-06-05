/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-lines-per-function */
/**
 * Equipment API Routes
 * Handles CRUD operations for equipment and position management
 */

import { Router } from 'express';
import type { EquipmentAPI, PaginationQueryParams } from '../../types/index.js';
import type { BasePosition } from '../../types/position.types.js';
import type { EquipmentService } from '../../services/equipment.service.js';
import {
  sanitizeEquipmentQuery,
  sanitizePositionQuery,
  parseTimeRangeQuery,
} from '../../infrastructure/utils/query-parser.js';
import { asyncHandler } from '../../infrastructure/utils/async-handler.js';

export const createEquipmentRoutes = (equipmentService: EquipmentService): Router => {
  const router = Router();

  // GET /api/equipment - List equipment with filtering and pagination
  router.get(
    '/',
    asyncHandler(async (req: EquipmentAPI.ListRequest, res: EquipmentAPI.ListResponse) => {
      const { filter, pagination } = sanitizeEquipmentQuery(req.query);
      const result = await equipmentService.findEquipment(filter, pagination);

      res.json({
        success: true,
        data: result, // Fix: return the full paginated result, not just result.data
        timestamp: new Date(),
      });
    }),
  );

  // GET /api/equipment/active - Get active equipment
  router.get(
    '/active',
    asyncHandler(async (req, res) => {
      const pagination = req.query as Partial<PaginationQueryParams>;

      // Fix: Handle undefined sortBy and sortOrder properly
      const paginationParams = {
        page: Number(pagination.page) || 1,
        limit: Number(pagination.limit) || 20,
        ...(pagination.sortBy && { sortBy: pagination.sortBy }),
        ...(pagination.sortOrder && { sortOrder: pagination.sortOrder }),
      };

      const result = await equipmentService.getActiveEquipment(paginationParams);

      res.json({
        success: true,
        data: result.data,
        timestamp: new Date(),
        pagination: result.pagination,
      });
    }),
  );

  // GET /api/equipment/maintenance - Get equipment due for maintenance
  router.get(
    '/maintenance',
    asyncHandler(async (req, res) => {
      const equipment = await equipmentService.getMaintenanceDue();

      res.json({
        success: true,
        data: equipment,
        timestamp: new Date(),
      });
    }),
  );

  // GET /api/equipment/inactive - Get inactive equipment
  router.get(
    '/inactive',
    asyncHandler(async (req, res) => {
      const since = req.query.since as string;
      const inactiveSince = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      const equipment = await equipmentService.getInactiveEquipment(inactiveSince);

      res.json({
        success: true,
        data: equipment,
        timestamp: new Date(),
      });
    }),
  );

  // GET /api/equipment/:id - Get specific equipment
  router.get(
    '/:id',
    asyncHandler(async (req: EquipmentAPI.GetRequest, res: EquipmentAPI.GetResponse) => {
      // Fix: Ensure id parameter exists and is a string
      const equipmentId = req.params.id;
      if (!equipmentId) {
        res.status(400).json({
          success: false,
          error: 'Equipment ID is required',
          timestamp: new Date(),
        });
        return;
      }

      const equipment = await equipmentService.getEquipment(equipmentId);

      res.json({
        success: true,
        data: equipment,
        timestamp: new Date(),
      });
    }),
  );

  // POST /api/equipment - Create new equipment
  router.post(
    '/',
    asyncHandler(async (req: EquipmentAPI.CreateRequest, res: EquipmentAPI.CreateResponse) => {
      const equipment = await equipmentService.createEquipment(req.body);

      res.status(201).json({
        success: true,
        data: equipment,
        timestamp: new Date(),
      });
    }),
  );

  // PUT /api/equipment/:id - Update equipment
  router.put(
    '/:id',
    asyncHandler(async (req: EquipmentAPI.UpdateRequest, res: EquipmentAPI.UpdateResponse) => {
      const equipment = await equipmentService.updateEquipment(req.params.id, req.body);

      res.json({
        success: true,
        data: equipment,
        timestamp: new Date(),
      });
    }),
  );

  // DELETE /api/equipment/:id - Delete equipment
  router.delete(
    '/:id',
    asyncHandler(async (req: EquipmentAPI.DeleteRequest, res: EquipmentAPI.DeleteResponse) => {
      await equipmentService.deleteEquipment(req.params.id);

      res.json({
        success: true,
        data: { deleted: true },
        timestamp: new Date(),
      });
    }),
  );

  // GET /api/equipment/:id/health - Check equipment health
  router.get(
    '/:id/health',
    asyncHandler(async (req, res) => {
      // Fix: Ensure id parameter exists and is a string
      const equipmentId = req.params.id;
      if (!equipmentId) {
        res.status(400).json({
          success: false,
          error: 'Equipment ID is required',
          timestamp: new Date(),
        });
        return;
      }

      const health = await equipmentService.checkEquipmentHealth(equipmentId);

      res.json({
        success: true,
        data: health,
        timestamp: new Date(),
      });
    }),
  );

  // GET /api/equipment/:id/positions - Get equipment positions
  router.get(
    '/:id/positions',
    asyncHandler(
      async (req: EquipmentAPI.GetPositionsRequest, res: EquipmentAPI.GetPositionsResponse) => {
        const { filter, pagination } = sanitizePositionQuery(req.query);
        const result = await equipmentService.getEquipmentPositions(req.params.id, pagination);

        res.json({
          success: true,
          data: result, // Fix: return the full paginated result, not just result.data
          timestamp: new Date(),
        });
      },
    ),
  );

  // POST /api/equipment/:id/positions - Add position to equipment
  router.post(
    '/:id/positions',
    asyncHandler(
      async (req: EquipmentAPI.CreatePositionRequest, res: EquipmentAPI.CreatePositionResponse) => {
        // Create Position object from req.body with distanceTo method
        const position = {
          ...req.body,
          altitude: req.body.altitude ?? 0,
          accuracy: req.body.accuracy ?? 2.5,
          timestamp: req.body.timestamp ?? new Date(),
          distanceTo: (lastPosition: any): number => {
            // Simple implementation - replace with actual distance calculation if needed
            return 0;
          },
        };

        await equipmentService.updateEquipmentPosition(req.params.id, position);

        // Create a BasePosition response from the input data
        const positionResponse: BasePosition = {
          latitude: req.body.latitude,
          longitude: req.body.longitude,
          altitude: req.body.altitude ?? 0,
          accuracy: req.body.accuracy ?? 2.5, // Default accuracy from constants
          timestamp: req.body.timestamp ?? new Date(),
        };

        res.status(201).json({
          success: true,
          data: positionResponse,
          timestamp: new Date(),
        });
      },
    ),
  );

  // GET /api/equipment/:id/movement - Get movement analysis
  router.get(
    '/:id/movement',
    asyncHandler(
      async (req: EquipmentAPI.GetMovementRequest, res: EquipmentAPI.GetMovementResponse) => {
        const timeRange = parseTimeRangeQuery(req.query);
        const analysis = await equipmentService.getEquipmentMovementAnalysis(
          req.params.id,
          timeRange,
        );

        res.json({
          success: true,
          data: analysis,
          timestamp: new Date(),
        });
      },
    ),
  );

  return router;
};

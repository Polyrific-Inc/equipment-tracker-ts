/* eslint-disable complexity */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Equipment Controller
 * Handles all equipment-related HTTP requests and responses
 */

import type { Request, Response, NextFunction } from 'express';
import type {
  EquipmentAPI,
  AuthenticatedRequest,
  EquipmentId,
  CreateEquipmentData,
  UpdateEquipmentData,
} from '../../types/index.js';
import type { IEquipmentService } from '../../services/equipment.service.js';
import { createError } from '../middleware/error.middleware.js';
import {
  sanitizeEquipmentQuery,
  sanitizePositionQuery,
  parseTimeRangeQuery,
} from '../../infrastructure/utils/query-parser.js';
import { logger } from '../middleware/logging.middleware.js';
import { BasePosition } from '@/types/position.types.js';

export class EquipmentController {
  constructor(private equipmentService: IEquipmentService) {}

  /**
   * GET /api/equipment
   * List equipment with filtering and pagination
   */
  public list = async (
    req: EquipmentAPI.ListRequest,
    res: EquipmentAPI.ListResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { filter, pagination } = sanitizeEquipmentQuery(req.query);
      const result = await this.equipmentService.findEquipment(filter, pagination);

      logger.info('Equipment list retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        resultCount: result.data?.length ?? 0,
        totalCount: result.pagination.total,
        filters: Object.keys(filter).length > 0 ? filter : 'none',
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to list equipment', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        query: req.query,
      });
      next(error);
    }
  };

  /**
   * GET /api/equipment/:id
   * Get specific equipment by ID
   */
  public getById = async (
    req: EquipmentAPI.GetRequest,
    res: EquipmentAPI.GetResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const equipment = await this.equipmentService.getEquipment(id);

      logger.info('Equipment retrieved', {
        equipmentId: id,
        userId: (req as AuthenticatedRequest).user?.id,
      });

      res.json({
        success: true,
        data: equipment,
        timestamp: new Date(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        logger.warn('Equipment not found', {
          equipmentId: req.params.id,
          userId: (req as AuthenticatedRequest).user?.id,
        });
        return next(createError.notFound('Equipment'));
      }

      logger.error('Failed to get equipment', {
        equipmentId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * POST /api/equipment
   * Create new equipment
   */
  public create = async (
    req: EquipmentAPI.CreateRequest,
    res: EquipmentAPI.CreateResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const equipmentData: CreateEquipmentData = req.body;
      const equipment = await this.equipmentService.createEquipment(equipmentData);

      logger.info('Equipment created', {
        equipmentId: equipment.id,
        equipmentType: equipment.type,
        createdBy: (req as AuthenticatedRequest).user?.id,
      });

      res.status(201).json({
        success: true,
        data: equipment,
        timestamp: new Date(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        logger.warn('Equipment creation failed - already exists', {
          equipmentId: req.body.id,
          userId: (req as AuthenticatedRequest).user?.id,
        });
        return next(createError.conflict('Equipment with this ID already exists'));
      }

      logger.error('Failed to create equipment', {
        equipmentData: req.body,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * PUT /api/equipment/:id
   * Update existing equipment
   */
  public update = async (
    req: EquipmentAPI.UpdateRequest,
    res: EquipmentAPI.UpdateResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData: UpdateEquipmentData = req.body;

      const equipment = await this.equipmentService.updateEquipment(id, updateData);

      logger.info('Equipment updated', {
        equipmentId: id,
        updates: Object.keys(updateData),
        updatedBy: (req as AuthenticatedRequest).user?.id,
      });

      res.json({
        success: true,
        data: equipment,
        timestamp: new Date(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        logger.warn('Equipment update failed - not found', {
          equipmentId: req.params.id,
          userId: (req as AuthenticatedRequest).user?.id,
        });
        return next(createError.notFound('Equipment'));
      }

      logger.error('Failed to update equipment', {
        equipmentId: req.params.id,
        updateData: req.body,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * DELETE /api/equipment/:id
   * Delete equipment
   */
  public delete = async (
    req: EquipmentAPI.DeleteRequest,
    res: EquipmentAPI.DeleteResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      await this.equipmentService.deleteEquipment(id);

      logger.info('Equipment deleted', {
        equipmentId: id,
        deletedBy: (req as AuthenticatedRequest).user?.id,
      });

      res.json({
        success: true,
        data: { deleted: true },
        timestamp: new Date(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        logger.warn('Equipment deletion failed - not found', {
          equipmentId: req.params.id,
          userId: (req as AuthenticatedRequest).user?.id,
        });
        return next(createError.notFound('Equipment'));
      }

      logger.error('Failed to delete equipment', {
        equipmentId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * GET /api/equipment/active
   * Get active equipment
   */
  public getActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pagination = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await this.equipmentService.getActiveEquipment(pagination);

      logger.info('Active equipment retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        count: result.data?.length ?? 0,
      });

      res.json({
        success: true,
        data: result.data,
        timestamp: new Date(),
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Failed to get active equipment', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * GET /api/equipment/maintenance
   * Get equipment due for maintenance
   */
  public getMaintenanceDue = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const equipment = await this.equipmentService.getMaintenanceDue();

      logger.info('Maintenance due equipment retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        count: equipment.length,
      });

      res.json({
        success: true,
        data: equipment,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to get maintenance due equipment', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * GET /api/equipment/inactive
   * Get inactive equipment
   */
  public getInactive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const since = req.query.since as string;
      const inactiveSince = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000);

      if (isNaN(inactiveSince.getTime())) {
        return next(createError.badRequest('Invalid date format for "since" parameter'));
      }

      const equipment = await this.equipmentService.getInactiveEquipment(inactiveSince);

      logger.info('Inactive equipment retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        count: equipment.length,
        since: inactiveSince,
      });

      res.json({
        success: true,
        data: equipment,
        timestamp: new Date(),
        meta: {
          inactiveSince,
          totalFound: equipment.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get inactive equipment', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        since: req.query.since,
      });
      next(error);
    }
  };

  /**
   * GET /api/equipment/:id/health
   * Check equipment health
   */
  public checkHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        return next(createError.badRequest('Equipment ID is required'));
      }

      const health = await this.equipmentService.checkEquipmentHealth(id);

      logger.info('Equipment health checked', {
        equipmentId: id,
        healthStatus: health.status,
        issueCount: health.issues.length,
        userId: (req as AuthenticatedRequest).user?.id,
      });

      res.json({
        success: true,
        data: health,
        timestamp: new Date(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return next(createError.notFound('Equipment'));
      }

      logger.error('Failed to check equipment health', {
        equipmentId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * GET /api/equipment/:id/positions
   * Get equipment positions
   */
  public getPositions = async (
    req: EquipmentAPI.GetPositionsRequest,
    res: EquipmentAPI.GetPositionsResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { filter, pagination } = sanitizePositionQuery(req.query);

      const result = await this.equipmentService.getEquipmentPositions(id, pagination);

      logger.info('Equipment positions retrieved', {
        equipmentId: id,
        positionCount: result.data?.length ?? 0,
        userId: (req as AuthenticatedRequest).user?.id,
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return next(createError.notFound('Equipment'));
      }

      logger.error('Failed to get equipment positions', {
        equipmentId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * POST /api/equipment/:id/positions
   * Add position to equipment
   */
  public addPosition = async (
    req: EquipmentAPI.CreatePositionRequest,
    res: EquipmentAPI.CreatePositionResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const positionData = req.body;

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

      await this.equipmentService.updateEquipmentPosition(req.params.id, position);

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
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return next(createError.notFound('Equipment'));
      }

      logger.error('Failed to add position to equipment', {
        equipmentId: req.params.id,
        positionData: req.body,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * GET /api/equipment/:id/movement
   * Get movement analysis for equipment
   */
  public getMovementAnalysis = async (
    req: EquipmentAPI.GetMovementRequest,
    res: EquipmentAPI.GetMovementResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const timeRange = parseTimeRangeQuery(req.query);
      const analysis = await this.equipmentService.getEquipmentMovementAnalysis(
        req.params.id,
        timeRange,
      );

      res.json({
        success: true,
        data: analysis,
        timestamp: new Date(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return next(createError.notFound('Equipment'));
      }

      logger.error('Failed to get movement analysis', {
        equipmentId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * GET /api/equipment/summary
   * Get equipment summary statistics
   */
  public getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [totalEquipment, activeEquipment, maintenanceEquipment, inactiveEquipment] =
        await Promise.all([
          this.equipmentService.getAllEquipment({ page: 1, limit: 1 }),
          this.equipmentService.getActiveEquipment({ page: 1, limit: 1 }),
          this.equipmentService.getMaintenanceDue(),
          this.equipmentService.getInactiveEquipment(new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ]);

      const summary = {
        totalEquipment: totalEquipment.pagination.total,
        activeEquipment: activeEquipment.pagination.total,
        maintenanceEquipment: maintenanceEquipment.length,
        inactiveEquipment: inactiveEquipment.length,
        utilizationRate:
          totalEquipment.pagination.total > 0
            ? Math.round((activeEquipment.pagination.total / totalEquipment.pagination.total) * 100)
            : 0,
      };

      logger.info('Equipment summary retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        summary,
      });

      res.json({
        success: true,
        data: summary,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to get equipment summary', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };
}

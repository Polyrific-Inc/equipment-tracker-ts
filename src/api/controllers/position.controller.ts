/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-depth */
/* eslint-disable complexity */
/* eslint-disable max-lines-per-function */
/**
 * Position Controller
 * Handles position data queries, bulk operations, and live feeds
 */

import type { Request, Response, NextFunction } from 'express';
import type { PositionAPI, AuthenticatedRequest, GeographicBounds } from '../../types/index.js';
import type { IPositionRepository } from '../../repositories/position.repository.js';
import type { IGpsTrackingService } from '../../services/gps-tracking.service.js';
import type { IAppService } from '../../services/app.service.js';
import { createError } from '../middleware/error.middleware.js';
import {
  sanitizePositionQuery,
  parseGeographicBounds,
} from '../../infrastructure/utils/query-parser.js';
import { logger } from '../middleware/logging.middleware.js';

export class PositionController {
  constructor(
    private positionRepository: IPositionRepository,
    private gpsTrackingService: IGpsTrackingService,
    private appService: IAppService,
  ) {}

  /**
   * Helper function to convert stored positions to PositionWithMetadata
   */
  private convertToPositionWithMetadata = (positions: any[]) => {
    return positions.map(pos => ({
      id: pos.id,
      equipmentId: pos.equipmentId,
      latitude: pos.latitude,
      longitude: pos.longitude,
      altitude: pos.altitude,
      accuracy: pos.accuracy,
      timestamp: pos.timestamp,
      source: pos.source,
      speed: pos.speed,
      heading: pos.heading,
      satellites: pos.satellites,
      distanceTo: pos.distanceTo,
    }));
  };

  /**
   * GET /api/positions
   * List positions with filtering and pagination
   */
  public list = async (
    req: PositionAPI.ListRequest,
    res: PositionAPI.ListResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { filter, pagination } = sanitizePositionQuery(req.query);
      const result = await this.positionRepository.findByFilter(filter, pagination);
      const positionsWithMetadata = this.convertToPositionWithMetadata(result.data ?? []);

      res.json({
        success: true,
        data: {
          data: positionsWithMetadata,
          pagination: result.pagination,
          success: true,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to list positions', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        query: req.query,
      });
      next(error);
    }
  };

  /**
   * GET /api/positions/latest
   * Get latest positions for all equipment
   */
  public getLatest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = Number(req.query.limit) || 50;

      if (limit > 1000) {
        return next(createError.badRequest('Limit cannot exceed 1000'));
      }

      const positions = await this.positionRepository.getLatestPositions(limit);
      const positionsWithMetadata = this.convertToPositionWithMetadata(positions);

      logger.info('Latest positions retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        limit,
        resultCount: positionsWithMetadata.length,
      });

      res.json({
        success: true,
        data: positionsWithMetadata,
        timestamp: new Date(),
        meta: {
          limit,
          totalReturned: positionsWithMetadata.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get latest positions', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        limit: req.query.limit,
      });
      next(error);
    }
  };

  /**
   * GET /api/positions/live
   * Get live positions for specific equipment or area
   */
  public getLive = async (
    req: PositionAPI.LiveRequest,
    res: PositionAPI.LiveResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const equipmentIds = req.query.equipmentIds ? req.query.equipmentIds.split(',') : undefined;
      const boundsJson = req.query.bounds;
      const bounds = parseGeographicBounds(boundsJson);

      let positions;
      let filterType = 'all';

      if (equipmentIds) {
        const result = await this.positionRepository.findByEquipmentIds(equipmentIds, {
          page: 1,
          limit: 100,
        });
        positions = result.data ?? [];
        filterType = 'equipment';
      } else if (bounds) {
        const result = await this.positionRepository.findInArea(bounds, { page: 1, limit: 100 });
        positions = result.data ?? [];
        filterType = 'area';
      } else {
        positions = await this.positionRepository.getLatestPositions(100);
        filterType = 'latest';
      }

      const positionsWithMetadata = this.convertToPositionWithMetadata(positions);

      logger.info('Live positions retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        filterType,
        equipmentIds: equipmentIds?.length,
        bounds: bounds ? 'provided' : 'none',
        resultCount: positionsWithMetadata.length,
      });

      res.json({
        success: true,
        data: positionsWithMetadata,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to get live positions', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        query: req.query,
      });
      next(error);
    }
  };

  /**
   * POST /api/positions/bulk
   * Bulk create positions
   */
  public bulkCreate = async (
    req: PositionAPI.BulkCreateRequest,
    res: PositionAPI.BulkCreateResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { positions } = req.body;
      const errors: string[] = [];
      let created = 0;

      for (const positionData of positions) {
        try {
          await this.appService.processPositionUpdate(positionData.equipmentId, {
            latitude: positionData.latitude,
            longitude: positionData.longitude,
            altitude: positionData.altitude ?? undefined,
            accuracy: positionData.accuracy ?? undefined,
            timestamp: positionData.timestamp ?? undefined,
          });
          created++;
        } catch (error) {
          errors.push(
            `Failed to create position for equipment ${positionData.equipmentId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      res.status(created > 0 ? 201 : 400).json({
        success: created > 0,
        data: { created, errors },
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to bulk create positions', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        positionCount: req.body.positions?.length || 0,
      });
      next(error);
    }
  };

  /**
   * GET /api/positions/area
   * Get positions within geographic area
   */
  public getInArea = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { minLat, maxLat, minLng, maxLng } = req.query as Record<string, string>;

      if (!minLat || !maxLat || !minLng || !maxLng) {
        return next(
          createError.badRequest('Missing required parameters: minLat, maxLat, minLng, maxLng'),
        );
      }

      const bounds: GeographicBounds = {
        southWest: { lat: Number(minLat), lng: Number(minLng) },
        northEast: { lat: Number(maxLat), lng: Number(maxLng) },
      };

      // Validate bounds
      if (
        bounds.southWest.lat >= bounds.northEast.lat ||
        bounds.southWest.lng >= bounds.northEast.lng
      ) {
        return next(createError.badRequest('Invalid geographic bounds'));
      }

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await this.positionRepository.findInArea(bounds, { page, limit });
      const positionsWithMetadata = this.convertToPositionWithMetadata(result.data ?? []);

      logger.info('Positions in area retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        bounds,
        resultCount: positionsWithMetadata.length,
        totalCount: result.pagination.total,
      });

      res.json({
        success: true,
        data: positionsWithMetadata,
        timestamp: new Date(),
        pagination: result.pagination,
        meta: {
          searchArea: bounds,
          equipmentFound: new Set(positionsWithMetadata.map(p => p.equipmentId)).size,
        },
      });
    } catch (error) {
      logger.error('Failed to get positions in area', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        query: req.query,
      });
      next(error);
    }
  };

  /**
   * GET /api/positions/near
   * Get positions near a specific point
   */
  public getNear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { lat, lng, radius } = req.query as Record<string, string>;

      if (!lat || !lng || !radius) {
        return next(createError.badRequest('Missing required parameters: lat, lng, radius'));
      }

      const latitude = Number(lat);
      const longitude = Number(lng);
      const radiusMeters = Number(radius);

      if (radiusMeters > 50000) {
        return next(createError.badRequest('Radius cannot exceed 50km'));
      }

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await this.positionRepository.findNearPosition(
        latitude,
        longitude,
        radiusMeters,
        { page, limit },
      );

      const positionsWithMetadata = this.convertToPositionWithMetadata(result.data ?? []);

      logger.info('Positions near point retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        center: { lat: latitude, lng: longitude },
        radius: radiusMeters,
        resultCount: positionsWithMetadata.length,
      });

      res.json({
        success: true,
        data: positionsWithMetadata,
        timestamp: new Date(),
        pagination: result.pagination,
        meta: {
          searchCenter: { latitude, longitude },
          searchRadius: radiusMeters,
          equipmentFound: new Set(positionsWithMetadata.map(p => p.equipmentId)).size,
        },
      });
    } catch (error) {
      logger.error('Failed to get positions near point', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        query: req.query,
      });
      next(error);
    }
  };

  /**
   * GET /api/positions/accuracy
   * Get positions by accuracy range
   */
  public getByAccuracy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const minAccuracy = req.query.min ? Number(req.query.min) : undefined;
      const maxAccuracy = req.query.max ? Number(req.query.max) : undefined;

      if (minAccuracy !== undefined && (minAccuracy < 0 || minAccuracy > 1000)) {
        return next(createError.badRequest('Min accuracy must be between 0 and 1000 meters'));
      }

      if (maxAccuracy !== undefined && (maxAccuracy < 0 || maxAccuracy > 1000)) {
        return next(createError.badRequest('Max accuracy must be between 0 and 1000 meters'));
      }

      if (minAccuracy !== undefined && maxAccuracy !== undefined && minAccuracy > maxAccuracy) {
        return next(createError.badRequest('Min accuracy cannot be greater than max accuracy'));
      }

      const positions = await this.positionRepository.getPositionsByAccuracy(
        minAccuracy,
        maxAccuracy,
      );
      const positionsWithMetadata = this.convertToPositionWithMetadata(positions);

      logger.info('Positions by accuracy retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        minAccuracy,
        maxAccuracy,
        resultCount: positionsWithMetadata.length,
      });

      res.json({
        success: true,
        data: positionsWithMetadata,
        timestamp: new Date(),
        meta: {
          accuracyFilter: { min: minAccuracy, max: maxAccuracy },
          averageAccuracy:
            positionsWithMetadata.length > 0
              ? Math.round(
                  (positionsWithMetadata.reduce((sum, p) => sum + p.accuracy, 0) /
                    positionsWithMetadata.length) *
                    100,
                ) / 100
              : 0,
        },
      });
    } catch (error) {
      logger.error('Failed to get positions by accuracy', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        query: req.query,
      });
      next(error);
    }
  };

  /**
   * GET /api/positions/stats
   * Get position statistics
   */
  public getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const equipmentId = req.query.equipmentId as string | undefined;
      const count = await this.positionRepository.getPositionCount(equipmentId);
      const trackingStats = await this.gpsTrackingService.getTrackingStatistics();

      logger.info('Position statistics retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        equipmentId,
        totalPositions: count,
        trackedEquipment: trackingStats.totalTrackedEquipment,
      });

      res.json({
        success: true,
        data: {
          totalPositions: count,
          ...trackingStats,
          statsFor: equipmentId ?? 'all equipment',
        },
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to get position statistics', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        equipmentId: req.query.equipmentId,
      });
      next(error);
    }
  };

  /**
   * DELETE /api/positions/cleanup
   * Clean up old positions
   */
  public cleanup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const daysOld = Number(req.query.days) || 30;

      if (daysOld < 1 || daysOld > 365) {
        return next(createError.badRequest('Days must be between 1 and 365'));
      }

      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      const deletedCount = await this.positionRepository.deleteOlderThan(cutoffDate);

      logger.info('Position cleanup completed', {
        userId: (req as AuthenticatedRequest).user?.id,
        daysOld,
        cutoffDate,
        deletedCount,
      });

      res.json({
        success: true,
        data: {
          deletedCount,
          cutoffDate,
          daysOld,
        },
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to cleanup positions', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        daysOld: req.query.days,
      });
      next(error);
    }
  };

  /**
   * POST /api/positions/analyze
   * Analyze position patterns
   */
  public analyzePatterns = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { equipmentIds, timeRange, analysisType } = req.body;

      if (!equipmentIds || !Array.isArray(equipmentIds) || equipmentIds.length === 0) {
        return next(createError.badRequest('Equipment IDs are required'));
      }

      if (equipmentIds.length > 50) {
        return next(createError.badRequest('Cannot analyze more than 50 equipment items at once'));
      }

      const startTime = timeRange?.start
        ? new Date(timeRange.start)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endTime = timeRange?.end ? new Date(timeRange.end) : new Date();

      // Get positions for analysis
      const analysisResults = [];

      for (const equipmentId of equipmentIds) {
        try {
          const positions = await this.positionRepository.findByEquipmentInTimeRange(
            equipmentId,
            { start: startTime, end: endTime },
            { page: 1, limit: 1000 },
          );

          if (positions.data && positions.data.length > 1) {
            const positionList = positions.data;

            // Calculate basic statistics
            let totalDistance = 0;
            let maxSpeed = 0;
            const speeds: number[] = [];

            for (let i = 1; i < positionList.length; i++) {
              const current = positionList[i];
              const previous = positionList[i - 1];

              if (current && previous) {
                // Simple distance calculation (in a real implementation, use proper geospatial functions)
                const distance =
                  Math.sqrt(
                    Math.pow(current.latitude - previous.latitude, 2) +
                      Math.pow(current.longitude - previous.longitude, 2),
                  ) * 111320; // Rough conversion to meters

                const timeDiff =
                  (current.timestamp.getTime() - previous.timestamp.getTime()) / 1000;
                const speed = timeDiff > 0 ? distance / timeDiff : 0;

                totalDistance += distance;
                speeds.push(speed);
                maxSpeed = Math.max(maxSpeed, speed);
              }
            }

            const avgSpeed =
              speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

            analysisResults.push({
              equipmentId,
              positionCount: positionList.length,
              totalDistance: Math.round(totalDistance),
              averageSpeed: Math.round(avgSpeed * 100) / 100,
              maxSpeed: Math.round(maxSpeed * 100) / 100,
              timeRange: { start: startTime, end: endTime },
              isActive: speeds.some(s => s > 0.5), // Consider active if speed > 0.5 m/s
            });
          } else {
            analysisResults.push({
              equipmentId,
              positionCount: 0,
              totalDistance: 0,
              averageSpeed: 0,
              maxSpeed: 0,
              timeRange: { start: startTime, end: endTime },
              isActive: false,
            });
          }
        } catch (equipmentError) {
          logger.warn('Failed to analyze equipment', {
            equipmentId,
            error:
              equipmentError instanceof Error ? equipmentError.message : String(equipmentError),
          });
        }
      }

      logger.info('Position pattern analysis completed', {
        userId: (req as AuthenticatedRequest).user?.id,
        equipmentCount: equipmentIds.length,
        analysisType: analysisType || 'basic',
        timeRange: { start: startTime, end: endTime },
      });

      res.json({
        success: true,
        data: {
          analysis: analysisResults,
          summary: {
            totalEquipment: analysisResults.length,
            activeEquipment: analysisResults.filter(r => r.isActive).length,
            totalDistance: analysisResults.reduce((sum, r) => sum + r.totalDistance, 0),
            averageUtilization:
              analysisResults.length > 0
                ? Math.round(
                    (analysisResults.filter(r => r.isActive).length / analysisResults.length) * 100,
                  )
                : 0,
          },
        },
        timestamp: new Date(),
        meta: {
          analysisType: analysisType || 'basic',
          timeRange: { start: startTime, end: endTime },
          requestedEquipment: equipmentIds.length,
        },
      });
    } catch (error) {
      logger.error('Failed to analyze position patterns', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        requestBody: req.body,
      });
      next(error);
    }
  };
}

/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-lines-per-function */
/**
 * Position API Routes
 * Handles position data queries, bulk operations, and live feeds
 */

import { Router } from 'express';
import type { PositionAPI, GeographicBounds } from '../../types/index.js';
import type { IPositionRepository } from '../../repositories/position.repository.js';
import type { GpsTrackingService } from '../../services/gps-tracking.service.js';
import type { AppService } from '../../services/app.service.js';
import {
  sanitizePositionQuery,
  parseGeographicBounds,
} from '../../infrastructure/utils/query-parser.js';
import { asyncHandler } from '../../infrastructure/utils/async-handler.js';

export const createPositionRoutes = (
  positionRepository: IPositionRepository,
  gpsTrackingService: GpsTrackingService,
  appService: AppService,
): Router => {
  const router = Router();

  // Helper function to convert stored positions to PositionWithMetadata
  const convertToPositionWithMetadata = (positions: any[]) => {
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

  // GET /api/positions - List positions with filtering and pagination
  router.get(
    '/',
    asyncHandler(async (req: PositionAPI.ListRequest, res: PositionAPI.ListResponse) => {
      const { filter, pagination } = sanitizePositionQuery(req.query);
      const result = await positionRepository.findByFilter(filter, pagination);
      const positionsWithMetadata = convertToPositionWithMetadata(result.data ?? []);

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
    }),
  );

  // GET /api/positions/latest - Get latest positions for all equipment
  router.get(
    '/latest',
    asyncHandler(async (req, res) => {
      const limit = Number(req.query.limit) || 50;
      const positions = await positionRepository.getLatestPositions(limit);
      const positionsWithMetadata = convertToPositionWithMetadata(positions);

      res.json({
        success: true,
        data: positionsWithMetadata,
        timestamp: new Date(),
      });
    }),
  );

  // GET /api/positions/live - Get live positions for specific equipment or area
  router.get(
    '/live',
    asyncHandler(async (req: PositionAPI.LiveRequest, res: PositionAPI.LiveResponse) => {
      const equipmentIds = req.query.equipmentIds ? req.query.equipmentIds.split(',') : undefined;
      const boundsJson = req.query.bounds;
      const bounds = parseGeographicBounds(boundsJson);

      let positions;

      if (equipmentIds) {
        const result = await positionRepository.findByEquipmentIds(equipmentIds, {
          page: 1,
          limit: 100,
        });
        positions = result.data ?? [];
      } else if (bounds) {
        const result = await positionRepository.findInArea(bounds, { page: 1, limit: 100 });
        positions = result.data ?? [];
      } else {
        positions = await positionRepository.getLatestPositions(100);
      }

      const positionsWithMetadata = convertToPositionWithMetadata(positions);

      res.json({
        success: true,
        data: positionsWithMetadata,
        timestamp: new Date(),
      });
    }),
  );

  // POST /api/positions/bulk - Bulk create positions
  router.post(
    '/bulk',
    asyncHandler(
      async (req: PositionAPI.BulkCreateRequest, res: PositionAPI.BulkCreateResponse) => {
        const { positions } = req.body;
        const errors: string[] = [];
        let created = 0;

        for (const positionData of positions) {
          try {
            await appService.processPositionUpdate(positionData.equipmentId, {
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
      },
    ),
  );

  // GET /api/positions/area - Get positions within geographic area
  router.get(
    '/area',
    asyncHandler(async (req, res) => {
      const { minLat, maxLat, minLng, maxLng } = req.query as Record<string, string>;

      if (!minLat || !maxLat || !minLng || !maxLng) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: minLat, maxLat, minLng, maxLng',
          timestamp: new Date(),
        });
        return;
      }

      const bounds: GeographicBounds = {
        southWest: { lat: Number(minLat), lng: Number(minLng) },
        northEast: { lat: Number(maxLat), lng: Number(maxLng) },
      };

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await positionRepository.findInArea(bounds, { page, limit });
      const positionsWithMetadata = convertToPositionWithMetadata(result.data ?? []);

      res.json({
        success: true,
        data: positionsWithMetadata,
        timestamp: new Date(),
        pagination: result.pagination,
      });
    }),
  );

  // GET /api/positions/near - Get positions near a specific point
  router.get(
    '/near',
    asyncHandler(async (req, res) => {
      const { lat, lng, radius } = req.query as Record<string, string>;

      if (!lat || !lng || !radius) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: lat, lng, radius',
          timestamp: new Date(),
        });
        return;
      }

      const latitude = Number(lat);
      const longitude = Number(lng);
      const radiusMeters = Number(radius);
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await positionRepository.findNearPosition(latitude, longitude, radiusMeters, {
        page,
        limit,
      });

      const positionsWithMetadata = convertToPositionWithMetadata(result.data ?? []);

      res.json({
        success: true,
        data: positionsWithMetadata,
        timestamp: new Date(),
        pagination: result.pagination,
      });
    }),
  );

  // GET /api/positions/accuracy - Get positions by accuracy range
  router.get(
    '/accuracy',
    asyncHandler(async (req, res) => {
      const minAccuracy = req.query.min ? Number(req.query.min) : undefined;
      const maxAccuracy = req.query.max ? Number(req.query.max) : undefined;

      const positions = await positionRepository.getPositionsByAccuracy(minAccuracy, maxAccuracy);
      const positionsWithMetadata = convertToPositionWithMetadata(positions);

      res.json({
        success: true,
        data: positionsWithMetadata,
        timestamp: new Date(),
      });
    }),
  );

  // GET /api/positions/stats - Get position statistics
  router.get(
    '/stats',
    asyncHandler(async (req, res) => {
      const equipmentId = req.query.equipmentId as string | undefined;
      const count = await positionRepository.getPositionCount(equipmentId);
      const trackingStats = await gpsTrackingService.getTrackingStatistics();

      res.json({
        success: true,
        data: {
          totalPositions: count,
          ...trackingStats,
        },
        timestamp: new Date(),
      });
    }),
  );

  // DELETE /api/positions/cleanup - Clean up old positions
  router.delete(
    '/cleanup',
    asyncHandler(async (req, res) => {
      const daysOld = Number(req.query.days) || 30;
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const deletedCount = await positionRepository.deleteOlderThan(cutoffDate);

      res.json({
        success: true,
        data: { deletedCount, cutoffDate },
        timestamp: new Date(),
      });
    }),
  );

  return router;
};

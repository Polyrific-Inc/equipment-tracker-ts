/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable complexity */
/* eslint-disable max-lines-per-function */
/**
 * Geofence Controller
 * Handles geofence management and violation tracking
 */

import type { Request, Response, NextFunction } from 'express';
import type { GeofenceAPI, AuthenticatedRequest } from '../../types/index.js';
import type { IAlertService } from '../../services/alert.service.js';
import { createError } from '../middleware/error.middleware.js';
import { parseTimeRangeQuery } from '../../infrastructure/utils/query-parser.js';
import { logger } from '../middleware/logging.middleware.js';
import {
  calculateHaversineDistance,
  isPointInCircle,
  isPointInBounds,
} from '../../infrastructure/utils/distance-calculator.js';

// Base interface for geofence creation data
interface GeofenceCreateData {
  name: string;
  type: 'circle' | 'rectangle' | 'polygon';
  active?: boolean;
  description?: string;
}

// Circular geofence data with center point and radius
interface CircularGeofenceData extends GeofenceCreateData {
  type: 'circle';
  center: { latitude: number; longitude: number };
  radius: number;
}

// Rectangular geofence data with bounds
interface RectangularGeofenceData extends GeofenceCreateData {
  type: 'rectangle';
  bounds: {
    northEast: { lat: number; lng: number };
    southWest: { lat: number; lng: number };
  };
}

// Polygon geofence data with vertices
interface PolygonGeofenceData extends GeofenceCreateData {
  type: 'polygon';
  vertices: Array<{ latitude: number; longitude: number }>;
}

export class GeofenceController {
  constructor(private alertService: IAlertService) {}

  /**
   * Helper function for point-in-polygon test using ray casting algorithm
   */
  private isPointInPolygon(
    lat: number,
    lng: number,
    vertices: Array<{ latitude: number; longitude: number }>,
  ): boolean {
    let inside = false;

    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i]?.latitude ?? 0;
      const yi = vertices[i]?.longitude ?? 0;
      const xj = vertices[j]?.latitude ?? 0;
      const yj = vertices[j]?.longitude ?? 0;

      if (yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Helper function to calculate distance to geofence center (for circular geofences)
   */
  private calculateDistanceToGeofence(lat: number, lng: number, geofence: any): number | null {
    if (geofence.type === 'circle' && geofence.center) {
      return calculateHaversineDistance(
        lat,
        lng,
        geofence.center.latitude,
        geofence.center.longitude,
      );
    }
    return null;
  }

  /**
   * Helper function to check if position is inside geofence
   */
  private isPositionInGeofence(latitude: number, longitude: number, geofence: any): boolean {
    switch (geofence.type) {
      case 'circle':
        if (geofence.center && geofence.radius) {
          return isPointInCircle(
            latitude,
            longitude,
            geofence.center.latitude,
            geofence.center.longitude,
            geofence.radius,
          );
        }
        return false;

      case 'rectangle':
        if (geofence.bounds) {
          return isPointInBounds(
            latitude,
            longitude,
            geofence.bounds.northEast.lat,
            geofence.bounds.northEast.lng,
            geofence.bounds.southWest.lat,
            geofence.bounds.southWest.lng,
          );
        }
        return false;

      case 'polygon':
        if (geofence.vertices && Array.isArray(geofence.vertices)) {
          return this.isPointInPolygon(latitude, longitude, geofence.vertices);
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * GET /api/geofences
   * List all geofences with pagination
   */
  public list = async (
    req: GeofenceAPI.ListRequest,
    res: GeofenceAPI.ListResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const geofences = await this.alertService.getGeofences();

      // Apply pagination
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedGeofences = geofences.slice(startIndex, endIndex);

      const totalPages = Math.ceil(geofences.length / limit);

      res.json({
        success: true,
        data: {
          data: paginatedGeofences,
          pagination: {
            page,
            limit,
            total: geofences.length,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
          success: true,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to list geofences', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * GET /api/geofences/active
   * Get only active geofences
   */
  public getActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const geofences = await this.alertService.getGeofences();
      const activeGeofences = geofences.filter(gf => gf.active);

      logger.info('Active geofences retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        totalGeofences: geofences.length,
        activeGeofences: activeGeofences.length,
      });

      res.json({
        success: true,
        data: activeGeofences,
        timestamp: new Date(),
        meta: {
          totalGeofences: geofences.length,
          activeCount: activeGeofences.length,
          inactiveCount: geofences.length - activeGeofences.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get active geofences', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * GET /api/geofences/types
   * Get available geofence types with examples
   */
  public getTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const geofenceTypes = [
        {
          type: 'circle',
          name: 'Circular Geofence',
          description: 'Defined by center point and radius',
          requiredFields: ['center', 'radius'],
          example: {
            center: { latitude: 37.7749, longitude: -122.4194 },
            radius: 500,
          },
        },
        {
          type: 'rectangle',
          name: 'Rectangular Geofence',
          description: 'Defined by northeast and southwest corners',
          requiredFields: ['bounds'],
          example: {
            bounds: {
              northEast: { lat: 37.785, lng: -122.409 },
              southWest: { lat: 37.78, lng: -122.414 },
            },
          },
        },
        {
          type: 'polygon',
          name: 'Polygon Geofence',
          description: 'Defined by multiple vertices',
          requiredFields: ['vertices'],
          example: {
            vertices: [
              { latitude: 37.7749, longitude: -122.4194 },
              { latitude: 37.775, longitude: -122.418 },
              { latitude: 37.774, longitude: -122.417 },
            ],
          },
        },
      ];

      logger.info('Geofence types retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        typeCount: geofenceTypes.length,
      });

      res.json({
        success: true,
        data: geofenceTypes,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to get geofence types', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * POST /api/geofences
   * Create new geofence
   */
  public create = async (
    req: GeofenceAPI.CreateRequest,
    res: GeofenceAPI.CreateResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Cast req.body to our typed interface for proper type checking
      const body = req.body as GeofenceCreateData;

      // Validate required fields
      const { name, type, active = true } = body;

      if (!name || !type) {
        res.status(400).json({
          success: false,
          error: 'Name and type are required fields',
          timestamp: new Date(),
        });
        return;
      }

      // Validate geofence type-specific data
      if (type === 'circle') {
        const circularData = body as CircularGeofenceData;
        if (!circularData.center || !circularData.radius) {
          res.status(400).json({
            success: false,
            error: 'Circular geofence requires center and radius',
            timestamp: new Date(),
          });
          return;
        }
      } else if (type === 'rectangle') {
        const rectangularData = body as RectangularGeofenceData;
        if (!rectangularData.bounds) {
          res.status(400).json({
            success: false,
            error: 'Rectangular geofence requires bounds',
            timestamp: new Date(),
          });
          return;
        }
      } else if (type === 'polygon') {
        const polygonData = body as PolygonGeofenceData;
        if (
          !polygonData.vertices ||
          !Array.isArray(polygonData.vertices) ||
          polygonData.vertices.length < 3
        ) {
          res.status(400).json({
            success: false,
            error: 'Polygon geofence requires at least 3 vertices',
            timestamp: new Date(),
          });
          return;
        }
      }

      const geofence = await this.alertService.addGeofence(req.body);

      res.status(201).json({
        success: true,
        data: geofence,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to create geofence', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        geofenceData: req.body,
      });
      next(error);
    }
  };

  /**
   * GET /api/geofences/:id
   * Get specific geofence
   */
  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const geofences = await this.alertService.getGeofences();
      const geofence = geofences.find(gf => gf.id === id);

      if (!geofence) {
        logger.warn('Geofence not found', {
          geofenceId: id,
          userId: (req as AuthenticatedRequest).user?.id,
        });
        return next(createError.notFound('Geofence'));
      }

      logger.info('Geofence retrieved', {
        geofenceId: id,
        geofenceName: geofence.name,
        userId: (req as AuthenticatedRequest).user?.id,
      });

      res.json({
        success: true,
        data: geofence,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to get geofence', {
        geofenceId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * PUT /api/geofences/:id
   * Update geofence
   */
  public update = async (
    req: GeofenceAPI.UpdateRequest,
    res: GeofenceAPI.UpdateResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const geofences = await this.alertService.getGeofences();
      const existingGeofence = geofences.find(gf => gf.id === id);

      if (!existingGeofence) {
        logger.warn('Geofence update failed - not found', {
          geofenceId: id,
          userId: (req as AuthenticatedRequest).user?.id,
        });
        return next(createError.notFound('Geofence'));
      }

      // Validate update data
      if (updateData.type && updateData.type !== existingGeofence.type) {
        return next(createError.badRequest('Cannot change geofence type after creation'));
      }

      // Since AlertService doesn't have an update method, we simulate it
      // In a real implementation, you'd implement proper update functionality
      const updatedGeofence = {
        ...existingGeofence,
        ...updateData,
        id: existingGeofence.id, // Preserve original ID
        createdAt: existingGeofence.createdAt, // Preserve creation date
        updatedAt: new Date(),
      };

      logger.info('Geofence updated', {
        geofenceId: id,
        updates: Object.keys(updateData),
        updatedBy: (req as AuthenticatedRequest).user?.id,
      });

      // TODO: Implement actual update in AlertService
      res.json({
        success: true,
        data: updatedGeofence as typeof existingGeofence,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to update geofence', {
        geofenceId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        updateData: req.body,
      });
      next(error);
    }
  };

  /**
   * DELETE /api/geofences/:id
   * Delete geofence
   */
  public delete = async (
    req: GeofenceAPI.DeleteRequest,
    res: GeofenceAPI.DeleteResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;

      await this.alertService.removeGeofence(id);

      logger.info('Geofence deleted', {
        geofenceId: id,
        deletedBy: (req as AuthenticatedRequest).user?.id,
      });

      res.json({
        success: true,
        data: { deleted: true },
        timestamp: new Date(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        logger.warn('Geofence deletion failed - not found', {
          geofenceId: req.params.id,
          userId: (req as AuthenticatedRequest).user?.id,
        });
        return next(createError.notFound('Geofence'));
      }

      logger.error('Failed to delete geofence', {
        geofenceId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * POST /api/geofences/:id/activate
   * Activate geofence
   */
  public activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const geofences = await this.alertService.getGeofences();
      const geofence = geofences.find(gf => gf.id === id);

      if (!geofence) {
        return next(createError.notFound('Geofence'));
      }

      // TODO: Implement actual activation in AlertService
      const activatedGeofence = { ...geofence, active: true, updatedAt: new Date() };

      logger.info('Geofence activated', {
        geofenceId: id,
        geofenceName: geofence.name,
        activatedBy: (req as AuthenticatedRequest).user?.id,
      });

      res.json({
        success: true,
        data: activatedGeofence,
        message: `Geofence ${geofence.name} has been activated`,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to activate geofence', {
        geofenceId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * POST /api/geofences/:id/deactivate
   * Deactivate geofence
   */
  public deactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const geofences = await this.alertService.getGeofences();
      const geofence = geofences.find(gf => gf.id === id);

      if (!geofence) {
        return next(createError.notFound('Geofence'));
      }

      // TODO: Implement actual deactivation in AlertService
      const deactivatedGeofence = { ...geofence, active: false, updatedAt: new Date() };

      logger.info('Geofence deactivated', {
        geofenceId: id,
        geofenceName: geofence.name,
        deactivatedBy: (req as AuthenticatedRequest).user?.id,
      });

      res.json({
        success: true,
        data: deactivatedGeofence,
        message: `Geofence ${geofence.name} has been deactivated`,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to deactivate geofence', {
        geofenceId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * GET /api/geofences/:id/violations
   * Get violations for specific geofence
   */
  public getViolations = async (
    req: GeofenceAPI.GetViolationsRequest,
    res: GeofenceAPI.GetViolationsResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const timeRange = parseTimeRangeQuery(req.query);

      // Get all alerts and filter for geofence violations for this geofence
      const alerts = await this.alertService.getAlerts();
      let violations = alerts.filter(
        alert => alert.type === 'geofence_violation' && alert.metadata?.geofenceId === id,
      );

      // Apply time range filter if specified
      if (timeRange) {
        violations = violations.filter(
          alert => alert.timestamp >= timeRange.start && alert.timestamp <= timeRange.end,
        );
      }

      // Apply pagination
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedViolations = violations.slice(startIndex, endIndex);

      const totalPages = Math.ceil(violations.length / limit);

      logger.info('Geofence violations retrieved', {
        geofenceId: id,
        totalViolations: violations.length,
        returnedViolations: paginatedViolations.length,
        timeRange,
        userId: (req as AuthenticatedRequest).user?.id,
      });

      res.json({
        success: true,
        data: {
          data: paginatedViolations,
          pagination: {
            page,
            limit,
            total: violations.length,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
          success: true,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to get geofence violations', {
        geofenceId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * GET /api/geofences/violations/recent
   * Get recent violations across all geofences
   */
  public getRecentViolations = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const limit = Number(req.query.limit) || 10;
      const hours = Number(req.query.hours) || 24;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      if (limit > 100) {
        return next(createError.badRequest('Limit cannot exceed 100'));
      }

      if (hours > 168) {
        // 1 week
        return next(createError.badRequest('Hours cannot exceed 168 (1 week)'));
      }

      const alerts = await this.alertService.getAlerts();

      const recentViolations = alerts
        .filter(alert => alert.type === 'geofence_violation' && alert.timestamp >= since)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);

      logger.info('Recent geofence violations retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        limit,
        hours,
        resultCount: recentViolations.length,
      });

      res.json({
        success: true,
        data: recentViolations,
        timestamp: new Date(),
        meta: {
          timeRange: { since, limit, hours },
          totalFound: recentViolations.length,
          violationTypes: {
            entered: recentViolations.filter(v => v.metadata?.violationType === 'entered').length,
            exited: recentViolations.filter(v => v.metadata?.violationType === 'exited').length,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get recent geofence violations', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        query: req.query,
      });
      next(error);
    }
  };

  /**
   * GET /api/geofences/violations/stats
   * Get comprehensive violation statistics
   */
  public getViolationStats = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const alerts = await this.alertService.getAlerts();
      const violations = alerts.filter(alert => alert.type === 'geofence_violation');

      // Group violations by geofence
      const violationsByGeofence: Record<string, number> = {};
      const violationsByEquipment: Record<string, number> = {};
      const violationsByType: Record<string, number> = {};

      for (const violation of violations) {
        const geofenceId = violation.metadata?.geofenceId as string;
        const equipmentId = violation.equipmentId;
        const violationType = violation.metadata?.violationType as string;

        if (geofenceId) {
          violationsByGeofence[geofenceId] = (violationsByGeofence[geofenceId] ?? 0) + 1;
        }

        violationsByEquipment[equipmentId] = (violationsByEquipment[equipmentId] ?? 0) + 1;

        if (violationType) {
          violationsByType[violationType] = (violationsByType[violationType] ?? 0) + 1;
        }
      }

      // Time-based statistics
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const violationsToday = violations.filter(v => v.timestamp >= today).length;
      const violationsThisWeek = violations.filter(v => v.timestamp >= thisWeek).length;
      const violationsThisMonth = violations.filter(v => v.timestamp >= thisMonth).length;

      // Calculate statistics - fix potential undefined access
      const lastViolation = violations[violations.length - 1];
      const averageViolationsPerDay =
        violations.length > 0 && lastViolation
          ? violations.length /
            Math.max(
              1,
              Math.ceil(
                (now.getTime() - lastViolation.timestamp.getTime()) / (24 * 60 * 60 * 1000),
              ),
            )
          : 0;

      const stats = {
        totalViolations: violations.length,
        violationsToday,
        violationsThisWeek,
        violationsThisMonth,
        violationsByGeofence,
        violationsByEquipment,
        violationsByType,
        mostViolatedGeofence:
          Object.entries(violationsByGeofence).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null,
        equipmentWithMostViolations:
          Object.entries(violationsByEquipment).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null,
        averageViolationsPerDay,
      };

      res.json({
        success: true,
        data: stats,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to get violation statistics', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * POST /api/geofences/test
   * Test if a position is within any geofence
   */
  public testPosition = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { latitude, longitude, equipmentId } = req.body;

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return next(createError.badRequest('Latitude and longitude must be numbers'));
      }

      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return next(
          createError.badRequest(
            'Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180',
          ),
        );
      }

      const geofences = await this.alertService.getGeofences();
      const activeGeofences = geofences.filter(gf => gf.active);

      const matchingGeofences = [];

      // Test position against each geofence
      for (const geofence of activeGeofences) {
        const isInside = this.isPositionInGeofence(latitude, longitude, geofence);

        if (isInside) {
          matchingGeofences.push({
            ...geofence,
            distanceToCenter: this.calculateDistanceToGeofence(latitude, longitude, geofence),
          });
        }
      }

      logger.info('Position tested against geofences', {
        userId: (req as AuthenticatedRequest).user?.id,
        position: { latitude, longitude },
        equipmentId,
        activeGeofencesCount: activeGeofences.length,
        matchingGeofencesCount: matchingGeofences.length,
      });

      res.json({
        success: true,
        data: {
          position: { latitude, longitude },
          equipmentId,
          matchingGeofences,
          isInsideAnyGeofence: matchingGeofences.length > 0,
          activeGeofencesCount: activeGeofences.length,
          testTimestamp: new Date(),
        },
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to test position against geofences', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        requestBody: req.body,
      });
      next(error);
    }
  };

  /**
   * GET /api/geofences/summary
   * Get summary of all geofences
   */
  public getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const geofences = await this.alertService.getGeofences();
      const alerts = await this.alertService.getAlerts();
      const violations = alerts.filter(alert => alert.type === 'geofence_violation');

      const summary = {
        totalGeofences: geofences.length,
        activeGeofences: geofences.filter(gf => gf.active).length,
        inactiveGeofences: geofences.filter(gf => !gf.active).length,
        geofencesByType: {
          circle: geofences.filter(gf => gf.type === 'circle').length,
          rectangle: geofences.filter(gf => gf.type === 'rectangle').length,
          polygon: geofences.filter(gf => gf.type === 'polygon').length,
        },
        totalViolations: violations.length,
        recentViolations: violations.filter(
          v => v.timestamp >= new Date(Date.now() - 24 * 60 * 60 * 1000),
        ).length,
        geofencesWithViolations: new Set(
          violations.map(v => v.metadata?.geofenceId).filter(Boolean),
        ).size,
      };

      logger.info('Geofence summary retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        totalGeofences: summary.totalGeofences,
        activeGeofences: summary.activeGeofences,
        totalViolations: summary.totalViolations,
      });

      res.json({
        success: true,
        data: summary,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to get geofence summary', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };
}

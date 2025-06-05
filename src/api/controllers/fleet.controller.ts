/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Fleet Management Controller
 * Handles fleet-wide operations, statistics, and alerts
 */

import type { Request, Response, NextFunction } from 'express';
import type { FleetAPI, AuthenticatedRequest } from '../../types/index.js';
import type { IEquipmentService } from '../../services/equipment.service.js';
import type { IAlertService } from '../../services/alert.service.js';
import type { IAppService } from '../../services/app.service.js';
import { createError } from '../middleware/error.middleware.js';
import { parseTimeRangeQuery } from '../../infrastructure/utils/query-parser.js';
import { logger } from '../middleware/logging.middleware.js';

export class FleetController {
  constructor(
    private equipmentService: IEquipmentService,
    private alertService: IAlertService,
    private appService: IAppService,
  ) {}

  /**
   * GET /api/fleet/stats
   * Get fleet statistics
   */
  public getStats = async (
    req: FleetAPI.StatsRequest,
    res: FleetAPI.StatsResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const timeRange = parseTimeRangeQuery(req.query);
      const stats = await this.equipmentService.getFleetStatistics();

      // If time range is specified, we could filter stats by that range
      // For now, we return current stats
      res.json({
        success: true,
        data: stats,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to get fleet statistics', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        query: req.query,
      });
      next(error);
    }
  };

  /**
   * GET /api/fleet/dashboard
   * Get dashboard summary data
   */
  public getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await this.equipmentService.getDashboardSummary();

      logger.info('Fleet dashboard retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        totalEquipment: summary.totalEquipment,
        activeEquipment: summary.activeEquipment,
        alertCount: summary.alerts.length,
      });

      res.json({
        success: true,
        data: summary,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to get fleet dashboard', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * GET /api/fleet/health
   * Get overall fleet health status
   */
  public getHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const health = await this.appService.getHealthStatus();

      logger.info('Fleet health status retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        status: health.status,
        uptime: health.uptime,
      });

      res.json({
        success: true,
        data: health,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to get fleet health', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * GET /api/fleet/alerts
   * Get fleet alerts with filtering
   */
  public getAlerts = async (
    req: FleetAPI.AlertsRequest,
    res: FleetAPI.AlertsResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = req.query;
      const equipmentId = query.equipmentId;
      const acknowledged =
        query.acknowledged === 'true' ? true : query.acknowledged === 'false' ? false : undefined;
      const severity = query.severity;

      // Get alerts with filtering
      let alerts = await this.alertService.getAlerts(equipmentId);

      // Apply additional filters
      if (acknowledged !== undefined) {
        alerts = alerts.filter(alert => alert.acknowledged === acknowledged);
      }

      if (severity) {
        alerts = alerts.filter(alert => alert.severity === severity);
      }

      // Apply pagination
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedAlerts = alerts.slice(startIndex, endIndex);

      const totalPages = Math.ceil(alerts.length / limit);

      // Create the properly structured PaginatedResponse
      const paginatedResponse = {
        success: true,
        data: {
          data: paginatedAlerts,
          pagination: {
            page,
            limit,
            total: alerts.length,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
          success: true,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };

      res.json(paginatedResponse);
    } catch (error) {
      logger.error('Failed to get fleet alerts', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        query: req.query,
      });
      next(error);
    }
  };

  /**
   * GET /api/fleet/alerts/unacknowledged
   * Get unacknowledged alerts
   */
  public getUnacknowledgedAlerts = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const alerts = await this.alertService.getUnacknowledgedAlerts();

      logger.info('Unacknowledged alerts retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        count: alerts.length,
      });

      res.json({
        success: true,
        data: alerts,
        timestamp: new Date(),
        meta: {
          totalUnacknowledged: alerts.length,
          criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
          highAlerts: alerts.filter(a => a.severity === 'high').length,
        },
      });
    } catch (error) {
      logger.error('Failed to get unacknowledged alerts', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * POST /api/fleet/alerts/:id/acknowledge
   * Acknowledge an alert
   */
  public acknowledgeAlert = async (
    req: FleetAPI.AcknowledgeAlertRequest,
    res: FleetAPI.AcknowledgeAlertResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { acknowledgedBy } = req.body;

      const alert = await this.alertService.acknowledgeAlert(id, acknowledgedBy);

      logger.info('Alert acknowledged', {
        alertId: id,
        acknowledgedBy,
        userId: (req as AuthenticatedRequest).user?.id,
        alertType: alert.type,
        equipmentId: alert.equipmentId,
      });

      res.json({
        success: true,
        data: alert,
        timestamp: new Date(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        logger.warn('Alert acknowledgment failed - not found', {
          alertId: req.params.id,
          userId: (req as AuthenticatedRequest).user?.id,
        });
        return next(createError.notFound('Alert'));
      }

      if (error instanceof Error && error.message.includes('already acknowledged')) {
        logger.warn('Alert acknowledgment failed - already acknowledged', {
          alertId: req.params.id,
          userId: (req as AuthenticatedRequest).user?.id,
        });
        return next(createError.conflict('Alert is already acknowledged'));
      }

      logger.error('Failed to acknowledge alert', {
        alertId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * GET /api/fleet/alerts/stats
   * Get alert statistics
   */
  public getAlertStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.alertService.getAlertStatistics();

      logger.info('Alert statistics retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        totalAlerts: stats.totalAlerts,
        unacknowledgedAlerts: stats.unacknowledgedAlerts,
      });

      res.json({
        success: true,
        data: stats,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to get alert statistics', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * POST /api/fleet/simulation/start
   * Start demo simulation
   */
  public startSimulation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.appService.startDemoSimulation();

      res.json({
        success: true,
        data: { message: 'Demo simulation started' },
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to start demo simulation', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * POST /api/fleet/simulation/stop
   * Stop all simulations
   */
  public stopSimulation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.appService.stopAllSimulations();

      logger.info('All simulations stopped', {
        userId: (req as AuthenticatedRequest).user?.id,
        stoppedAt: new Date(),
      });

      res.json({
        success: true,
        data: {
          message: 'All simulations stopped',
          stoppedAt: new Date(),
        },
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to stop simulations', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * GET /api/fleet/statistics
   * Get comprehensive application statistics
   */
  public getApplicationStats = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const stats = await this.appService.getApplicationStatistics();

      logger.info('Application statistics retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        uptime: stats.uptime,
        memoryUsage: Math.round(stats.memoryUsage.heapUsed / 1024 / 1024), // MB
      });

      res.json({
        success: true,
        data: stats,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to get application statistics', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * POST /api/fleet/tracking/start/:equipmentId
   * Start tracking specific equipment
   */
  public startTracking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { equipmentId } = req.params;

      if (!equipmentId) {
        return next(createError.badRequest('Equipment ID is required'));
      }

      await this.appService.startEquipmentTracking(equipmentId);

      logger.info('Equipment tracking started', {
        equipmentId,
        userId: (req as AuthenticatedRequest).user?.id,
      });

      res.json({
        success: true,
        data: {
          message: `Started tracking equipment ${equipmentId}`,
          equipmentId,
          startedAt: new Date(),
        },
        timestamp: new Date(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return next(createError.notFound('Equipment'));
      }

      logger.error('Failed to start equipment tracking', {
        equipmentId: req.params.equipmentId,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * POST /api/fleet/tracking/stop/:equipmentId
   * Stop tracking specific equipment
   */
  public stopTracking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { equipmentId } = req.params;

      if (!equipmentId) {
        return next(createError.badRequest('Equipment ID is required'));
      }

      await this.appService.stopEquipmentTracking(equipmentId);

      logger.info('Equipment tracking stopped', {
        equipmentId,
        userId: (req as AuthenticatedRequest).user?.id,
      });

      res.json({
        success: true,
        data: {
          message: `Stopped tracking equipment ${equipmentId}`,
          equipmentId,
          stoppedAt: new Date(),
        },
        timestamp: new Date(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return next(createError.notFound('Equipment'));
      }

      logger.error('Failed to stop equipment tracking', {
        equipmentId: req.params.equipmentId,
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * GET /api/fleet/overview
   * Get comprehensive fleet overview
   */
  public getOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [fleetStats, dashboard, alertStats, health] = await Promise.all([
        this.equipmentService.getFleetStatistics(),
        this.equipmentService.getDashboardSummary(),
        this.alertService.getAlertStatistics(),
        this.appService.getHealthStatus(),
      ]);

      const overview = {
        fleet: fleetStats,
        dashboard,
        alerts: alertStats,
        system: {
          status: health.status,
          uptime: health.uptime,
          version: health.version,
        },
        summary: {
          totalEquipment: fleetStats.totalEquipment,
          activeEquipment: fleetStats.activeEquipment,
          utilizationRate: Math.round(
            (fleetStats.activeEquipment / fleetStats.totalEquipment) * 100,
          ),
          criticalAlerts: alertStats.alertsBySeverity.critical ?? 0,
          unacknowledgedAlerts: alertStats.unacknowledgedAlerts,
        },
      };

      logger.info('Fleet overview retrieved', {
        userId: (req as AuthenticatedRequest).user?.id,
        totalEquipment: overview.summary.totalEquipment,
        utilizationRate: overview.summary.utilizationRate,
        criticalAlerts: overview.summary.criticalAlerts,
      });

      res.json({
        success: true,
        data: overview,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to get fleet overview', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
      });
      next(error);
    }
  };

  /**
   * POST /api/fleet/maintenance/schedule
   * Schedule maintenance for equipment
   */
  public scheduleMaintenance = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { equipmentIds, scheduledDate, maintenanceType, notes } = req.body;

      if (!equipmentIds || !Array.isArray(equipmentIds) || equipmentIds.length === 0) {
        return next(createError.badRequest('Equipment IDs are required'));
      }

      if (!scheduledDate) {
        return next(createError.badRequest('Scheduled date is required'));
      }

      // In a real implementation, you'd have a maintenance scheduling service
      // For now, we'll simulate the response
      const maintenanceSchedule = {
        id: `maintenance_${Date.now()}`,
        equipmentIds,
        scheduledDate: new Date(scheduledDate),
        maintenanceType: maintenanceType || 'routine',
        notes: notes || '',
        status: 'scheduled',
        createdBy: (req as AuthenticatedRequest).user?.id,
        createdAt: new Date(),
      };

      logger.info('Maintenance scheduled', {
        maintenanceId: maintenanceSchedule.id,
        equipmentIds,
        scheduledDate,
        maintenanceType,
        scheduledBy: (req as AuthenticatedRequest).user?.id,
      });

      res.status(201).json({
        success: true,
        data: maintenanceSchedule,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to schedule maintenance', {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as AuthenticatedRequest).user?.id,
        requestBody: req.body,
      });
      next(error);
    }
  };
}

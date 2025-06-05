/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-lines-per-function */
/**
 * Fleet Management API Routes
 * Handles fleet-wide operations, statistics, and alerts
 */

import { Router } from 'express';
import type { FleetAPI } from '../../types/index.js';
import type { EquipmentService } from '../../services/equipment.service.js';
import type { AlertService } from '../../services/alert.service.js';
import type { AppService } from '../../services/app.service.js';
import { parseTimeRangeQuery } from '../../infrastructure/utils/query-parser.js';
import { asyncHandler } from '../../infrastructure/utils/async-handler.js';

export const createFleetRoutes = (
  equipmentService: EquipmentService,
  alertService: AlertService,
  appService: AppService,
): Router => {
  const router = Router();

  // GET /api/fleet/stats - Get fleet statistics
  router.get(
    '/stats',
    asyncHandler(async (req: FleetAPI.StatsRequest, res: FleetAPI.StatsResponse) => {
      const timeRange = parseTimeRangeQuery(req.query);
      const stats = await equipmentService.getFleetStatistics();

      // If time range is specified, we could filter stats by that range
      // For now, we return current stats
      res.json({
        success: true,
        data: stats,
        timestamp: new Date(),
      });
    }),
  );

  // GET /api/fleet/dashboard - Get dashboard summary
  router.get(
    '/dashboard',
    asyncHandler(async (req, res) => {
      const summary = await equipmentService.getDashboardSummary();

      res.json({
        success: true,
        data: summary,
        timestamp: new Date(),
      });
    }),
  );

  // GET /api/fleet/health - Get fleet health status
  router.get(
    '/health',
    asyncHandler(async (req, res) => {
      const health = await appService.getHealthStatus();

      res.json({
        success: true,
        data: health,
        timestamp: new Date(),
      });
    }),
  );

  // GET /api/fleet/alerts - Get fleet alerts
  router.get(
    '/alerts',
    asyncHandler(async (req: FleetAPI.AlertsRequest, res: FleetAPI.AlertsResponse) => {
      const query = req.query;
      const equipmentId = query.equipmentId;
      const acknowledged =
        query.acknowledged === 'true' ? true : query.acknowledged === 'false' ? false : undefined;
      const severity = query.severity;

      // Get alerts with filtering
      let alerts = await alertService.getAlerts(equipmentId);

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
    }),
  );

  // GET /api/fleet/alerts/unacknowledged - Get unacknowledged alerts
  router.get(
    '/alerts/unacknowledged',
    asyncHandler(async (req, res) => {
      const alerts = await alertService.getUnacknowledgedAlerts();

      res.json({
        success: true,
        data: alerts,
        timestamp: new Date(),
      });
    }),
  );

  // POST /api/fleet/alerts/:id/acknowledge - Acknowledge alert
  router.post(
    '/alerts/:id/acknowledge',
    asyncHandler(
      async (req: FleetAPI.AcknowledgeAlertRequest, res: FleetAPI.AcknowledgeAlertResponse) => {
        const alert = await alertService.acknowledgeAlert(req.params.id, req.body.acknowledgedBy);

        res.json({
          success: true,
          data: alert,
          timestamp: new Date(),
        });
      },
    ),
  );

  // GET /api/fleet/alerts/stats - Get alert statistics
  router.get(
    '/alerts/stats',
    asyncHandler(async (req, res) => {
      const stats = await alertService.getAlertStatistics();

      res.json({
        success: true,
        data: stats,
        timestamp: new Date(),
      });
    }),
  );

  // POST /api/fleet/simulation/start - Start demo simulation
  router.post(
    '/simulation/start',
    asyncHandler(async (req, res) => {
      await appService.startDemoSimulation();

      res.json({
        success: true,
        data: { message: 'Demo simulation started' },
        timestamp: new Date(),
      });
    }),
  );

  // POST /api/fleet/simulation/stop - Stop all simulations
  router.post(
    '/simulation/stop',
    asyncHandler(async (req, res) => {
      await appService.stopAllSimulations();

      res.json({
        success: true,
        data: { message: 'All simulations stopped' },
        timestamp: new Date(),
      });
    }),
  );

  // GET /api/fleet/statistics - Get comprehensive application statistics
  router.get(
    '/statistics',
    asyncHandler(async (req, res) => {
      const stats = await appService.getApplicationStatistics();

      res.json({
        success: true,
        data: stats,
        timestamp: new Date(),
      });
    }),
  );

  // POST /api/fleet/tracking/start/:equipmentId - Start tracking specific equipment
  router.post(
    '/tracking/start/:equipmentId',
    asyncHandler(async (req, res) => {
      const equipmentId = req.params.equipmentId;
      if (!equipmentId) {
        res.status(400).json({
          success: false,
          error: 'Equipment ID is required',
          timestamp: new Date(),
        });
        return;
      }

      await appService.startEquipmentTracking(equipmentId);

      res.json({
        success: true,
        data: { message: `Started tracking equipment ${equipmentId}` },
        timestamp: new Date(),
      });
    }),
  );

  // POST /api/fleet/tracking/stop/:equipmentId - Stop tracking specific equipment
  router.post(
    '/tracking/stop/:equipmentId',
    asyncHandler(async (req, res) => {
      const equipmentId = req.params.equipmentId;
      if (!equipmentId) {
        res.status(400).json({
          success: false,
          error: 'Equipment ID is required',
          timestamp: new Date(),
        });
        return;
      }

      await appService.stopEquipmentTracking(equipmentId);

      res.json({
        success: true,
        data: { message: `Stopped tracking equipment ${equipmentId}` },
        timestamp: new Date(),
      });
    }),
  );

  return router;
};

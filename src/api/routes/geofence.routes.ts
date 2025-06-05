/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable complexity */
/* eslint-disable max-lines-per-function */
/**
 * Geofence API Routes
 * Handles geofence management and violation tracking
 */

import { Router } from 'express';
import type { GeofenceAPI } from '../../types/index.js';
import type { AlertService } from '../../services/alert.service.js';
import { parseTimeRangeQuery } from '../../infrastructure/utils/query-parser.js';
import { asyncHandler } from '../../infrastructure/utils/async-handler.js';

// Define proper geofence types to fix property access issues
interface CircularGeofenceData {
  name: string;
  type: 'circle';
  active: boolean;
  center: { latitude: number; longitude: number };
  radius: number;
}

interface RectangularGeofenceData {
  name: string;
  type: 'rectangle';
  active: boolean;
  bounds: {
    northEast: { lat: number; lng: number };
    southWest: { lat: number; lng: number };
  };
}

interface PolygonGeofenceData {
  name: string;
  type: 'polygon';
  active: boolean;
  vertices: Array<{ latitude: number; longitude: number }>;
}

type GeofenceCreateData = CircularGeofenceData | RectangularGeofenceData | PolygonGeofenceData;

export const createGeofenceRoutes = (alertService: AlertService): Router => {
  const router = Router();

  // GET /api/geofences - List all geofences with pagination
  router.get(
    '/',
    asyncHandler(async (req: GeofenceAPI.ListRequest, res: GeofenceAPI.ListResponse) => {
      const geofences = await alertService.getGeofences();

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
      return;
    }),
  );

  // GET /api/geofences/active - Get only active geofences
  router.get(
    '/active',
    asyncHandler(async (req, res) => {
      const geofences = await alertService.getGeofences();
      const activeGeofences = geofences.filter(gf => gf.active);

      res.json({
        success: true,
        data: activeGeofences,
        timestamp: new Date(),
      });
      return;
    }),
  );

  // GET /api/geofences/types - Get available geofence types
  router.get(
    '/types',
    asyncHandler(async (req, res) => {
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

      res.json({
        success: true,
        data: geofenceTypes,
        timestamp: new Date(),
      });
      return;
    }),
  );

  // POST /api/geofences - Create new geofence
  router.post(
    '/',
    asyncHandler(async (req: GeofenceAPI.CreateRequest, res: GeofenceAPI.CreateResponse) => {
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

      const geofence = await alertService.addGeofence(req.body);

      res.status(201).json({
        success: true,
        data: geofence,
        timestamp: new Date(),
      });
      return;
    }),
  );

  // GET /api/geofences/:id - Get specific geofence
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const geofences = await alertService.getGeofences();
      const geofence = geofences.find(gf => gf.id === req.params.id);

      if (!geofence) {
        res.status(404).json({
          success: false,
          error: `Geofence with ID ${req.params.id} not found`,
          timestamp: new Date(),
        });
        return;
      }

      res.json({
        success: true,
        data: geofence,
        timestamp: new Date(),
      });
      return;
    }),
  );

  // PUT /api/geofences/:id - Update geofence
  router.put(
    '/:id',
    asyncHandler(async (req: GeofenceAPI.UpdateRequest, res: GeofenceAPI.UpdateResponse) => {
      const geofences = await alertService.getGeofences();
      const existingGeofence = geofences.find(gf => gf.id === req.params.id);

      if (!existingGeofence) {
        res.status(404).json({
          success: false,
          error: `Geofence with ID ${req.params.id} not found`,
          timestamp: new Date(),
        });
        return;
      }

      // Validate update data
      const updateData = req.body;
      if (updateData.type && updateData.type !== existingGeofence.type) {
        res.status(400).json({
          success: false,
          error: 'Cannot change geofence type after creation',
          timestamp: new Date(),
        });
        return;
      }

      // Since AlertService doesn't have an update method, we simulate it
      // In a real implementation, you'd implement proper update functionality
      const updatedGeofence = {
        ...existingGeofence,
        ...updateData,
        id: existingGeofence.id, // Preserve original ID
        createdAt: existingGeofence.createdAt, // Preserve creation date
        updatedAt: new Date(),
        type: existingGeofence.type, // Ensure type remains the same
      };

      // TODO: Implement actual update in AlertService
      // For now, we just return the simulated updated geofence
      res.json({
        success: true,
        data: updatedGeofence as typeof existingGeofence,
        timestamp: new Date(),
      });
      return;
    }),
  );

  // DELETE /api/geofences/:id - Delete geofence
  router.delete(
    '/:id',
    asyncHandler(async (req: GeofenceAPI.DeleteRequest, res: GeofenceAPI.DeleteResponse) => {
      await alertService.removeGeofence(req.params.id);

      res.json({
        success: true,
        data: { deleted: true },
        timestamp: new Date(),
      });
      return;
    }),
  );

  // POST /api/geofences/:id/activate - Activate geofence
  router.post(
    '/:id/activate',
    asyncHandler(async (req, res) => {
      const geofences = await alertService.getGeofences();
      const geofence = geofences.find(gf => gf.id === req.params.id);

      if (!geofence) {
        res.status(404).json({
          success: false,
          error: `Geofence with ID ${req.params.id} not found`,
          timestamp: new Date(),
        });
        return;
      }

      // TODO: Implement actual activation in AlertService
      const activatedGeofence = { ...geofence, active: true, updatedAt: new Date() };

      res.json({
        success: true,
        data: activatedGeofence,
        message: `Geofence ${geofence.name} has been activated`,
        timestamp: new Date(),
      });
      return;
    }),
  );

  // POST /api/geofences/:id/deactivate - Deactivate geofence
  router.post(
    '/:id/deactivate',
    asyncHandler(async (req, res) => {
      const geofences = await alertService.getGeofences();
      const geofence = geofences.find(gf => gf.id === req.params.id);

      if (!geofence) {
        res.status(404).json({
          success: false,
          error: `Geofence with ID ${req.params.id} not found`,
          timestamp: new Date(),
        });
        return;
      }

      // TODO: Implement actual deactivation in AlertService
      const deactivatedGeofence = { ...geofence, active: false, updatedAt: new Date() };

      res.json({
        success: true,
        data: deactivatedGeofence,
        message: `Geofence ${geofence.name} has been deactivated`,
        timestamp: new Date(),
      });
      return;
    }),
  );

  // GET /api/geofences/:id/violations - Get violations for specific geofence
  router.get(
    '/:id/violations',
    asyncHandler(
      async (req: GeofenceAPI.GetViolationsRequest, res: GeofenceAPI.GetViolationsResponse) => {
        const timeRange = parseTimeRangeQuery(req.query);

        // Get all alerts and filter for geofence violations for this geofence
        const alerts = await alertService.getAlerts();
        let violations = alerts.filter(
          alert =>
            alert.type === 'geofence_violation' && alert.metadata?.geofenceId === req.params.id,
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
        return;
      },
    ),
  );

  // GET /api/geofences/violations/recent - Get recent violations across all geofences
  router.get(
    '/violations/recent',
    asyncHandler(async (req, res) => {
      const limit = Number(req.query.limit) || 10;
      const hours = Number(req.query.hours) || 24; // Default to last 24 hours
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const alerts = await alertService.getAlerts();

      const recentViolations = alerts
        .filter(alert => alert.type === 'geofence_violation' && alert.timestamp >= since)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);

      res.json({
        success: true,
        data: recentViolations,
        timestamp: new Date(),
        meta: {
          timeRange: { since, limit, hours },
          totalFound: recentViolations.length,
        },
      });
      return;
    }),
  );

  // GET /api/geofences/violations/stats - Get comprehensive violation statistics
  router.get(
    '/violations/stats',
    asyncHandler(async (req, res) => {
      const alerts = await alertService.getAlerts();
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
      return;
    }),
  );

  // POST /api/geofences/test - Test if a position is within any geofence
  router.post(
    '/test',
    asyncHandler(async (req, res) => {
      const { latitude, longitude, equipmentId } = req.body;

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        res.status(400).json({
          success: false,
          error: 'Latitude and longitude must be numbers',
          timestamp: new Date(),
        });
        return;
      }

      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        res.status(400).json({
          success: false,
          error:
            'Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180',
          timestamp: new Date(),
        });
        return;
      }

      const geofences = await alertService.getGeofences();
      const activeGeofences = geofences.filter(gf => gf.active);

      const matchingGeofences = [];

      // Test position against each geofence
      for (const geofence of activeGeofences) {
        let isInside = false;

        if (geofence.type === 'circle') {
          const circularGeofence = geofence as any;
          if (circularGeofence.center && circularGeofence.radius) {
            // Use Haversine formula for accurate distance calculation
            const R = 6371000; // Earth's radius in meters
            const lat1Rad = (latitude * Math.PI) / 180;
            const lat2Rad = (circularGeofence.center.latitude * Math.PI) / 180;
            const deltaLatRad = ((circularGeofence.center.latitude - latitude) * Math.PI) / 180;
            const deltaLonRad = ((circularGeofence.center.longitude - longitude) * Math.PI) / 180;

            const a =
              Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) *
                Math.cos(lat2Rad) *
                Math.sin(deltaLonRad / 2) *
                Math.sin(deltaLonRad / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c;

            isInside = distance <= circularGeofence.radius;
          }
        } else if (geofence.type === 'rectangle') {
          const rectangularGeofence = geofence as any;
          if (rectangularGeofence.bounds) {
            isInside =
              latitude >= rectangularGeofence.bounds.southWest.lat &&
              latitude <= rectangularGeofence.bounds.northEast.lat &&
              longitude >= rectangularGeofence.bounds.southWest.lng &&
              longitude <= rectangularGeofence.bounds.northEast.lng;
          }
        } else if (geofence.type === 'polygon') {
          const polygonGeofence = geofence as any;
          if (polygonGeofence.vertices && Array.isArray(polygonGeofence.vertices)) {
            // Point-in-polygon test using ray casting algorithm
            isInside = isPointInPolygon(latitude, longitude, polygonGeofence.vertices);
          }
        }

        if (isInside) {
          matchingGeofences.push({
            ...geofence,
            distanceToCenter:
              geofence.type === 'circle' ? calculateDistance(latitude, longitude, geofence) : null,
          });
        }
      }

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
      return;
    }),
  );

  // GET /api/geofences/summary - Get summary of all geofences
  router.get(
    '/summary',
    asyncHandler(async (req, res) => {
      const geofences = await alertService.getGeofences();
      const alerts = await alertService.getAlerts();
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

      res.json({
        success: true,
        data: summary,
        timestamp: new Date(),
      });
      return;
    }),
  );

  // Helper function for point-in-polygon test
  function isPointInPolygon(
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

  // Helper function to calculate distance to geofence center
  function calculateDistance(lat: number, lng: number, geofence: any): number | null {
    if (geofence.type === 'circle' && geofence.center) {
      const R = 6371000; // Earth's radius in meters
      const lat1Rad = (lat * Math.PI) / 180;
      const lat2Rad = (geofence.center.latitude * Math.PI) / 180;
      const deltaLatRad = ((geofence.center.latitude - lat) * Math.PI) / 180;
      const deltaLonRad = ((geofence.center.longitude - lng) * Math.PI) / 180;

      const a =
        Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
        Math.cos(lat1Rad) *
          Math.cos(lat2Rad) *
          Math.sin(deltaLonRad / 2) *
          Math.sin(deltaLonRad / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }
    return null;
  }

  return router;
};

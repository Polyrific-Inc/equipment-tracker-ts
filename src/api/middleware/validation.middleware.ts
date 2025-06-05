/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Validation Middleware
 * Request validation using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { createError } from './error.middleware.js';

// Base validation schemas
const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const timestampSchema = z.union([
  z.string().datetime(),
  z.date(),
  z.string().transform(str => new Date(str)),
]);

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Equipment validation schemas
const equipmentTypeSchema = z.enum([
  'forklift',
  'crane',
  'bulldozer',
  'excavator',
  'truck',
  'other',
] as const);
const equipmentStatusSchema = z.enum(['active', 'inactive', 'maintenance', 'unknown'] as const);

export const equipmentSchemas = {
  create: z.object({
    body: z.object({
      id: z
        .string()
        .min(1)
        .max(50)
        .regex(
          /^[A-Z0-9-_]+$/,
          'Equipment ID must contain only uppercase letters, numbers, hyphens, and underscores',
        ),
      type: equipmentTypeSchema,
      name: z.string().min(1).max(100),
      status: equipmentStatusSchema.optional(),
    }),
  }),

  update: z.object({
    params: z.object({
      id: z.string().min(1),
    }),
    body: z.object({
      name: z.string().min(1).max(100).optional(),
      status: equipmentStatusSchema.optional(),
    }),
  }),

  getById: z.object({
    params: z.object({
      id: z.string().min(1),
    }),
  }),

  list: z.object({
    query: z.object({
      type: z.string().optional(),
      status: z.string().optional(),
      createdAfter: z.string().optional(),
      createdBefore: z.string().optional(),
      updatedAfter: z.string().optional(),
      updatedBefore: z.string().optional(),
      hasPosition: z.enum(['true', 'false']).optional(),
      isMoving: z.enum(['true', 'false']).optional(),
      ...paginationSchema.shape,
    }),
  }),
};

// Position validation schemas
const positionSourceSchema = z.enum(['gps', 'network', 'manual', 'simulation'] as const);

export const positionSchemas = {
  create: z.object({
    body: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      altitude: z.number().optional(),
      accuracy: z.number().min(0).optional(),
      timestamp: timestampSchema.optional(),
    }),
  }),

  bulkCreate: z.object({
    body: z.object({
      positions: z
        .array(
          z.object({
            equipmentId: z.string().min(1),
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            altitude: z.number().optional(),
            accuracy: z.number().min(0).optional(),
            timestamp: timestampSchema.optional(),
          }),
        )
        .min(1)
        .max(1000),
    }),
  }),

  list: z.object({
    query: z.object({
      equipmentId: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      minLat: z.coerce.number().optional(),
      maxLat: z.coerce.number().optional(),
      minLng: z.coerce.number().optional(),
      maxLng: z.coerce.number().optional(),
      minAccuracy: z.coerce.number().optional(),
      maxAccuracy: z.coerce.number().optional(),
      source: z.string().optional(),
      hasSpeed: z.enum(['true', 'false']).optional(),
      minSpeed: z.coerce.number().optional(),
      maxSpeed: z.coerce.number().optional(),
      ...paginationSchema.shape,
    }),
  }),

  area: z.object({
    query: z.object({
      minLat: z.coerce.number().min(-90).max(90),
      maxLat: z.coerce.number().min(-90).max(90),
      minLng: z.coerce.number().min(-180).max(180),
      maxLng: z.coerce.number().min(-180).max(180),
      ...paginationSchema.shape,
    }),
  }),

  near: z.object({
    query: z.object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
      radius: z.coerce.number().min(1).max(50000), // Max 50km radius
      ...paginationSchema.shape,
    }),
  }),
};

// Geofence validation schemas
const geofenceTypeSchema = z.enum(['circle', 'rectangle', 'polygon'] as const);

const circularGeofenceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.literal('circle'),
  center: coordinateSchema,
  radius: z.number().min(1).max(50000), // Max 50km radius
  active: z.boolean().default(true),
});

const rectangularGeofenceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.literal('rectangle'),
  bounds: z.object({
    northEast: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
    southWest: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
  }),
  active: z.boolean().default(true),
});

const polygonGeofenceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.literal('polygon'),
  vertices: z.array(coordinateSchema).min(3).max(100),
  active: z.boolean().default(true),
});

export const geofenceSchemas = {
  create: z.object({
    body: z.discriminatedUnion('type', [
      circularGeofenceSchema,
      rectangularGeofenceSchema,
      polygonGeofenceSchema,
    ]),
  }),

  update: z.object({
    params: z.object({
      id: z.string().min(1),
    }),
    body: z.object({
      name: z.string().min(1).max(100).optional(),
      active: z.boolean().optional(),
      // Note: type-specific updates would need separate schemas
    }),
  }),

  getById: z.object({
    params: z.object({
      id: z.string().min(1),
    }),
  }),

  list: z.object({
    query: paginationSchema,
  }),

  violations: z.object({
    params: z.object({
      id: z.string().min(1),
    }),
    query: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
      ...paginationSchema.shape,
    }),
  }),

  test: z.object({
    body: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      equipmentId: z.string().optional(),
    }),
  }),
};

// Fleet validation schemas
export const fleetSchemas = {
  acknowledgeAlert: z.object({
    params: z.object({
      id: z.string().min(1),
    }),
    body: z.object({
      acknowledgedBy: z.string().min(1).max(100),
    }),
  }),

  alerts: z.object({
    query: z.object({
      equipmentId: z.string().optional(),
      acknowledged: z.enum(['true', 'false']).optional(),
      severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      ...paginationSchema.shape,
    }),
  }),

  stats: z.object({
    query: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }),
  }),
};

/**
 * Generic validation middleware factory
 */
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedData = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Attach validated data to request
      req.body = validatedData.body || req.body;
      req.query = validatedData.query || req.query;
      req.params = validatedData.params || req.params;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        const errorMessage = `Validation failed: ${validationErrors.map(e => e.message).join(', ')}`;
        next(createError.validation(errorMessage, { errors: validationErrors }));
      } else {
        next(error);
      }
    }
  };
};

/**
 * Validation middleware for equipment routes
 */
export const validateEquipment = {
  create: validate(equipmentSchemas.create),
  update: validate(equipmentSchemas.update),
  getById: validate(equipmentSchemas.getById),
  list: validate(equipmentSchemas.list),
};

/**
 * Validation middleware for position routes
 */
export const validatePosition = {
  create: validate(positionSchemas.create),
  bulkCreate: validate(positionSchemas.bulkCreate),
  list: validate(positionSchemas.list),
  area: validate(positionSchemas.area),
  near: validate(positionSchemas.near),
};

/**
 * Validation middleware for geofence routes
 */
export const validateGeofence = {
  create: validate(geofenceSchemas.create),
  update: validate(geofenceSchemas.update),
  getById: validate(geofenceSchemas.getById),
  list: validate(geofenceSchemas.list),
  violations: validate(geofenceSchemas.violations),
  test: validate(geofenceSchemas.test),
};

/**
 * Validation middleware for fleet routes
 */
export const validateFleet = {
  acknowledgeAlert: validate(fleetSchemas.acknowledgeAlert),
  alerts: validate(fleetSchemas.alerts),
  stats: validate(fleetSchemas.stats),
};

/**
 * Custom validation helpers
 */
export const customValidation = {
  /**
   * Validate equipment ID format
   */
  equipmentId: (req: Request, res: Response, next: NextFunction): void => {
    const { id } = req.params;
    if (!id || !/^[A-Z0-9-_]+$/.test(id)) {
      return next(createError.badRequest('Invalid equipment ID format'));
    }
    next();
  },

  /**
   * Validate date range
   */
  dateRange: (req: Request, res: Response, next: NextFunction): void => {
    const { start, end } = req.query;

    if (start && end) {
      const startDate = new Date(start as string);
      const endDate = new Date(end as string);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return next(createError.badRequest('Invalid date format'));
      }

      if (startDate >= endDate) {
        return next(createError.badRequest('Start date must be before end date'));
      }

      // Limit date range to prevent performance issues
      const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        return next(createError.badRequest('Date range cannot exceed 365 days'));
      }
    }

    next();
  },

  /**
   * Validate geographic bounds
   */
  geographicBounds: (req: Request, res: Response, next: NextFunction): void => {
    const { minLat, maxLat, minLng, maxLng } = req.query;

    if (minLat && maxLat && minLng && maxLng) {
      const minLatNum = Number(minLat);
      const maxLatNum = Number(maxLat);
      const minLngNum = Number(minLng);
      const maxLngNum = Number(maxLng);

      if (minLatNum >= maxLatNum) {
        return next(createError.badRequest('minLat must be less than maxLat'));
      }

      if (minLngNum >= maxLngNum) {
        return next(createError.badRequest('minLng must be less than maxLng'));
      }
    }

    next();
  },
};

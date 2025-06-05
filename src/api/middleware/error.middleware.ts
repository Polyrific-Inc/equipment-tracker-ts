/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-lines-per-function */
/* eslint-disable complexity */
/* eslint-disable no-console */
/**
 * Error Handling Middleware
 * Centralized error handling for the entire application
 */

import type { Request, Response, NextFunction } from 'express';
import type { HttpError } from '../../types/index.js';

// Custom error class for HTTP errors
export class AppError extends Error implements HttpError {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// Predefined error creators
export const createError = {
  badRequest: (message: string, details?: Record<string, unknown>): AppError =>
    new AppError(message, 400, 'BAD_REQUEST', details),

  unauthorized: (message: string = 'Authentication required'): AppError =>
    new AppError(message, 401, 'UNAUTHORIZED'),

  forbidden: (message: string = 'Access forbidden'): AppError =>
    new AppError(message, 403, 'FORBIDDEN'),

  notFound: (resource: string): AppError => new AppError(`${resource} not found`, 404, 'NOT_FOUND'),

  conflict: (message: string, details?: Record<string, unknown>): AppError =>
    new AppError(message, 409, 'CONFLICT', details),

  validation: (message: string, details?: Record<string, unknown>): AppError =>
    new AppError(message, 422, 'VALIDATION_ERROR', details),

  tooManyRequests: (message: string = 'Too many requests'): AppError =>
    new AppError(message, 429, 'TOO_MANY_REQUESTS'),

  internal: (message: string = 'Internal server error'): AppError =>
    new AppError(message, 500, 'INTERNAL_ERROR'),

  serviceUnavailable: (message: string = 'Service temporarily unavailable'): AppError =>
    new AppError(message, 503, 'SERVICE_UNAVAILABLE'),
};

/**
 * Development error response - includes stack trace
 */
const sendErrorDev = (err: AppError, res: Response): void => {
  res.status(err.statusCode).json({
    success: false,
    error: err.message,
    code: err.code,
    details: err.details,
    stack: err.stack,
    timestamp: new Date(),
  });
};

/**
 * Production error response - sanitized for security
 */
const sendErrorProd = (err: AppError, res: Response): void => {
  // Only send operational errors to client in production
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      details: err.details,
      timestamp: new Date(),
    });
  } else {
    // Don't leak error details for non-operational errors
    console.error('NON-OPERATIONAL ERROR:', err);
    res.status(500).json({
      success: false,
      error: 'Something went wrong',
      code: 'INTERNAL_ERROR',
      timestamp: new Date(),
    });
  }
};

/**
 * Handle specific error types and convert them to AppError
 */
const handleSpecificErrors = (err: any): AppError => {
  // Handle validation errors (e.g., from Joi, Zod, etc.)
  if (err.name === 'ValidationError') {
    const details = err.details?.reduce((acc: Record<string, string>, detail: any) => {
      acc[detail.path?.join('.') || 'unknown'] = detail.message;
      return acc;
    }, {});

    return createError.validation('Validation failed', details);
  }

  // Handle MongoDB duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
    return createError.conflict(`Duplicate value for ${field}`);
  }

  // Handle MongoDB cast errors
  if (err.name === 'CastError') {
    return createError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }

  // Handle JSON parsing errors
  if (err.type === 'entity.parse.failed') {
    return createError.badRequest('Invalid JSON in request body');
  }

  // Handle file size errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return createError.badRequest('File too large');
  }

  // Handle equipment service errors
  if (err.message?.includes('Equipment with ID') && err.message?.includes('not found')) {
    return createError.notFound('Equipment');
  }

  // Handle position service errors
  if (err.message?.includes('Invalid position data')) {
    return createError.validation('Invalid position data', { details: err.message });
  }

  // Handle geofence errors
  if (err.message?.includes('Geofence with ID') && err.message?.includes('not found')) {
    return createError.notFound('Geofence');
  }

  // Default to internal server error
  return new AppError(
    err.message ?? 'Internal server error',
    err.statusCode ?? 500,
    err.code ?? 'INTERNAL_ERROR',
    err.details,
  );
};

/**
 * Global error handling middleware
 * Must be the last middleware in the chain
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Convert error to AppError if it isn't already
  const appError = err instanceof AppError ? err : handleSpecificErrors(err);

  // Log error for monitoring
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, {
    error: appError.message,
    code: appError.code,
    statusCode: appError.statusCode,
    stack: appError.stack,
    userId: (req as any).user?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Send appropriate error response
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(appError, res);
  } else {
    sendErrorProd(appError, res);
  }
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = createError.notFound(`Route ${req.method} ${req.path}`);
  next(error);
};

/**
 * Async error wrapper - alternative to the one in routes
 */
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

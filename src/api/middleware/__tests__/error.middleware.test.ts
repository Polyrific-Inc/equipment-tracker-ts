// <test_code>
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { 
  AppError, 
  createError, 
  errorHandler, 
  notFoundHandler, 
  catchAsync, 
  sendErrorDev, 
  sendErrorProd 
} from '../../src/api/middleware/error-handler';

// Mock console.error to prevent test output pollution
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AppError', () => {
  it('should create an error with default values', () => {
    const error = new AppError('Test error');
    
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.details).toEqual({});
    expect(error.isOperational).toBe(true);
    expect(error.stack).toBeDefined();
  });

  it('should create an error with custom values', () => {
    const details = { field: 'value' };
    const error = new AppError('Custom error', 400, 'CUSTOM_CODE', details);
    
    expect(error.message).toBe('Custom error');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('CUSTOM_CODE');
    expect(error.details).toBe(details);
    expect(error.isOperational).toBe(true);
  });
});

describe('createError', () => {
  it('should create a badRequest error', () => {
    const details = { field: 'invalid' };
    const error = createError.badRequest('Bad request', details);
    
    expect(error.message).toBe('Bad request');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.details).toBe(details);
  });

  it('should create an unauthorized error with default message', () => {
    const error = createError.unauthorized();
    
    expect(error.message).toBe('Authentication required');
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('should create an unauthorized error with custom message', () => {
    const error = createError.unauthorized('Custom auth error');
    
    expect(error.message).toBe('Custom auth error');
    expect(error.statusCode).toBe(401);
  });

  it('should create a forbidden error', () => {
    const error = createError.forbidden();
    
    expect(error.message).toBe('Access forbidden');
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  it('should create a notFound error', () => {
    const error = createError.notFound('User');
    
    expect(error.message).toBe('User not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('should create a conflict error', () => {
    const details = { field: 'email' };
    const error = createError.conflict('Resource already exists', details);
    
    expect(error.message).toBe('Resource already exists');
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.details).toBe(details);
  });

  it('should create a validation error', () => {
    const details = { field: 'required' };
    const error = createError.validation('Validation failed', details);
    
    expect(error.message).toBe('Validation failed');
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toBe(details);
  });

  it('should create a tooManyRequests error', () => {
    const error = createError.tooManyRequests();
    
    expect(error.message).toBe('Too many requests');
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('should create an internal error', () => {
    const error = createError.internal();
    
    expect(error.message).toBe('Internal server error');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
  });

  it('should create a serviceUnavailable error', () => {
    const error = createError.serviceUnavailable();
    
    expect(error.message).toBe('Service temporarily unavailable');
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('errorHandler', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.MockedFunction<NextFunction>;
  
  beforeEach(() => {
    req = { 
      method: 'GET', 
      path: '/test', 
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-agent'),
      user: { id: 'user123' }
    };
    res = { 
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      headersSent: false
    };
    next = jest.fn();
  });

  it('should call next if headers are already sent', () => {
    res.headersSent = true;
    const error = new Error('Test error');
    
    errorHandler(error, req as Request, res as Response, next);
    
    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should handle AppError in development mode', () => {
    process.env.NODE_ENV = 'development';
    const error = new AppError('Test error', 400);
    
    errorHandler(error, req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Test error',
      code: 'INTERNAL_ERROR',
      stack: expect.any(String)
    }));
    expect(console.error).toHaveBeenCalled();
  });

  it('should handle AppError in production mode', () => {
    process.env.NODE_ENV = 'production';
    const error = new AppError('Test error', 400);
    
    errorHandler(error, req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Test error',
      code: 'INTERNAL_ERROR',
      details: {}
    }));
    expect(console.error).toHaveBeenCalled();
  });

  it('should handle non-operational errors in production mode', () => {
    process.env.NODE_ENV = 'production';
    const error = new Error('System error');
    
    errorHandler(error, req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Something went wrong',
      code: 'INTERNAL_ERROR'
    }));
    expect(console.error).toHaveBeenCalled();
  });

  it('should handle ValidationError', () => {
    const validationError = {
      name: 'ValidationError',
      details: [
        { path: ['email'], message: 'Invalid email' },
        { path: ['password'], message: 'Too short' }
      ]
    };
    
    errorHandler(validationError, req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'VALIDATION_ERROR',
      details: {
        'email': 'Invalid email',
        'password': 'Too short'
      }
    }));
  });

  it('should handle MongoDB duplicate key error', () => {
    const duplicateError = {
      code: 11000,
      keyValue: { email: 'test@example.com' }
    };
    
    errorHandler(duplicateError, req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'CONFLICT',
      error: 'Duplicate value for email'
    }));
  });

  it('should handle MongoDB cast error', () => {
    const castError = {
      name: 'CastError',
      path: 'userId',
      value: 'invalid-id'
    };
    
    errorHandler(castError, req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'BAD_REQUEST',
      error: 'Invalid userId: invalid-id'
    }));
  });

  it('should handle JSON parsing error', () => {
    const jsonError = {
      type: 'entity.parse.failed'
    };
    
    errorHandler(jsonError, req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'BAD_REQUEST',
      error: 'Invalid JSON in request body'
    }));
  });

  it('should handle file size error', () => {
    const fileSizeError = {
      code: 'LIMIT_FILE_SIZE'
    };
    
    errorHandler(fileSizeError, req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'BAD_REQUEST',
      error: 'File too large'
    }));
  });

  it('should handle equipment not found error', () => {
    const equipmentError = {
      message: 'Equipment with ID 123 not found'
    };
    
    errorHandler(equipmentError, req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'NOT_FOUND',
      error: 'Equipment not found'
    }));
  });

  it('should handle invalid position data error', () => {
    const positionError = {
      message: 'Invalid position data: coordinates out of range'
    };
    
    errorHandler(positionError, req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'VALIDATION_ERROR',
      error: 'Invalid position data'
    }));
  });

  it('should handle geofence not found error', () => {
    const geofenceError = {
      message: 'Geofence with ID 456 not found'
    };
    
    errorHandler(geofenceError, req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'NOT_FOUND',
      error: 'Geofence not found'
    }));
  });

  it('should handle generic errors', () => {
    const genericError = new Error('Something unexpected');
    
    errorHandler(genericError, req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INTERNAL_ERROR',
      error: 'Something unexpected'
    }));
  });
});

describe('notFoundHandler', () => {
  it('should create a not found error and pass it to next', () => {
    const req = { method: 'GET', path: '/unknown' } as Request;
    const res = {} as Response;
    const next = jest.fn();
    
    notFoundHandler(req, res, next);
    
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Route GET /unknown not found',
      statusCode: 404,
      code: 'NOT_FOUND'
    }));
  });
});

describe('catchAsync', () => {
  it('should resolve and return the function result', async () => {
    const req = {} as Request;
    const res = { json: jest.fn() } as unknown as Response;
    const next = jest.fn();
    
    const handler = jest.fn().mockResolvedValue({ success: true });
    const wrappedHandler = catchAsync(handler);
    
    await wrappedHandler(req, res, next);
    
    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('should catch errors and pass them to next', async () => {
    const req = {} as Request;
    const res = {} as Response;
    const next = jest.fn();
    const error = new Error('Async error');
    
    const handler = jest.fn().mockRejectedValue(error);
    const wrappedHandler = catchAsync(handler);
    
    await wrappedHandler(req, res, next);
    
    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
// </test_code>
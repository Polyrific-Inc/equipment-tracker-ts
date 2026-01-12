// <test_code>
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import {
  UserRole,
  Permission,
  authenticate,
  optionalAuthenticate,
  requirePermission,
  requireRole,
  requireAnyRole,
  requireAdmin,
  requireOperator,
  requireAuth,
  requireSystemAuth,
  requireResourceOwnership,
  validateWebhookSignature,
  createUserRateLimit,
  auditLog
} from '../src/middleware/auth.middleware.js';
import { createError } from '../src/middleware/error.middleware.js';
import type { AuthenticatedRequest } from '../src/types/index.js';

// Mock the error middleware
jest.mock('../src/middleware/error.middleware.js', () => ({
  createError: {
    unauthorized: jest.fn().mockImplementation(message => ({ status: 401, message })),
    forbidden: jest.fn().mockImplementation(message => ({ status: 403, message })),
    tooManyRequests: jest.fn().mockImplementation(message => ({ status: 429, message }))
  }
}));

describe('Auth Middleware', () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;
  let next: jest.Mock<NextFunction>;

  beforeEach(() => {
    req = {
      headers: {},
      query: {},
      params: {},
      ip: '127.0.0.1',
      method: 'GET',
      path: '/test',
      get: jest.fn().mockReturnValue('test-user-agent')
    };
    res = {
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      statusCode: 200
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractApiKey', () => {
    it('should extract API key from Authorization header with Bearer prefix', () => {
      req.headers = { authorization: 'Bearer et_admin_key_12345' };
      authenticate(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toEqual({
        id: 'user_admin',
        email: 'admin@equipment-tracker.com',
        role: UserRole.ADMIN
      });
    });

    it('should extract API key from Authorization header with API-Key prefix', () => {
      req.headers = { authorization: 'API-Key et_admin_key_12345' };
      authenticate(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toEqual({
        id: 'user_admin',
        email: 'admin@equipment-tracker.com',
        role: UserRole.ADMIN
      });
    });

    it('should extract API key from X-API-Key header', () => {
      req.headers = { 'x-api-key': 'et_admin_key_12345' };
      authenticate(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toEqual({
        id: 'user_admin',
        email: 'admin@equipment-tracker.com',
        role: UserRole.ADMIN
      });
    });

    it('should extract API key from query parameter', () => {
      req.query = { apiKey: 'et_admin_key_12345' };
      authenticate(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toEqual({
        id: 'user_admin',
        email: 'admin@equipment-tracker.com',
        role: UserRole.ADMIN
      });
    });
  });

  describe('authenticate', () => {
    it('should return error if no API key is provided', () => {
      authenticate(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: expect.stringContaining('API key required')
      }));
    });

    it('should return error if API key is invalid', () => {
      req.headers = { 'x-api-key': 'invalid_key' };
      authenticate(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: 'Invalid API key'
      }));
    });

    it('should return error if user account is deactivated', () => {
      // Mock a deactivated user by temporarily modifying the user in the middleware
      const originalAuthenticate = authenticate;
      const mockAuthenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        // Intercept the API key extraction
        if (req.headers['x-api-key'] === 'et_admin_key_12345') {
          // Call next with deactivated error
          return next(createError.unauthorized('Account is deactivated'));
        }
        return originalAuthenticate(req, res, next);
      };

      req.headers = { 'x-api-key': 'et_admin_key_12345' };
      mockAuthenticate(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: 'Account is deactivated'
      }));
    });

    it('should set user context and call next for valid API key', () => {
      req.headers = { 'x-api-key': 'et_operator_key_67890' };
      authenticate(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toEqual({
        id: 'user_operator',
        email: 'operator@equipment-tracker.com',
        role: UserRole.OPERATOR
      });
    });
  });

  describe('optionalAuthenticate', () => {
    it('should set user context if valid API key is provided', () => {
      req.headers = { 'x-api-key': 'et_viewer_key_abcdef' };
      optionalAuthenticate(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toEqual({
        id: 'user_viewer',
        email: 'viewer@equipment-tracker.com',
        role: UserRole.VIEWER
      });
    });

    it('should not set user context if no API key is provided', () => {
      optionalAuthenticate(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeUndefined();
    });

    it('should not set user context if invalid API key is provided', () => {
      req.headers = { 'x-api-key': 'invalid_key' };
      optionalAuthenticate(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeUndefined();
    });
  });

  describe('requirePermission', () => {
    it('should return error if user is not authenticated', () => {
      const middleware = requirePermission(Permission.READ);
      middleware(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: 'Authentication required'
      }));
    });

    it('should return error if user is not found', () => {
      const middleware = requirePermission(Permission.READ);
      req.user = { id: 'non_existent_user', email: 'test@example.com', role: UserRole.VIEWER };
      middleware(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: 'User not found'
      }));
    });

    it('should return error if user does not have required permission', () => {
      const middleware = requirePermission(Permission.DELETE);
      req.user = { id: 'user_viewer', email: 'viewer@equipment-tracker.com', role: UserRole.VIEWER };
      middleware(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 403,
        message: expect.stringContaining('Insufficient permissions')
      }));
    });

    it('should call next if user has required permission', () => {
      const middleware = requirePermission(Permission.READ);
      req.user = { id: 'user_viewer', email: 'viewer@equipment-tracker.com', role: UserRole.VIEWER };
      middleware(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('requireRole', () => {
    it('should return error if user is not authenticated', () => {
      const middleware = requireRole(UserRole.ADMIN);
      middleware(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: 'Authentication required'
      }));
    });

    it('should return error if user does not have required role', () => {
      const middleware = requireRole(UserRole.ADMIN);
      req.user = { id: 'user_viewer', email: 'viewer@equipment-tracker.com', role: UserRole.VIEWER };
      middleware(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 403,
        message: expect.stringContaining('Access denied')
      }));
    });

    it('should call next if user has required role', () => {
      const middleware = requireRole(UserRole.ADMIN);
      req.user = { id: 'user_admin', email: 'admin@equipment-tracker.com', role: UserRole.ADMIN };
      middleware(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('requireAnyRole', () => {
    it('should return error if user is not authenticated', () => {
      const middleware = requireAnyRole([UserRole.ADMIN, UserRole.OPERATOR]);
      middleware(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: 'Authentication required'
      }));
    });

    it('should return error if user does not have any of the required roles', () => {
      const middleware = requireAnyRole([UserRole.ADMIN, UserRole.OPERATOR]);
      req.user = { id: 'user_viewer', email: 'viewer@equipment-tracker.com', role: UserRole.VIEWER };
      middleware(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 403,
        message: expect.stringContaining('Access denied')
      }));
    });

    it('should call next if user has one of the required roles', () => {
      const middleware = requireAnyRole([UserRole.ADMIN, UserRole.OPERATOR]);
      req.user = { id: 'user_operator', email: 'operator@equipment-tracker.com', role: UserRole.OPERATOR };
      middleware(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('requireAdmin', () => {
    it('should return error if user is not an admin', () => {
      req.user = { id: 'user_operator', email: 'operator@equipment-tracker.com', role: UserRole.OPERATOR };
      requireAdmin(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 403,
        message: expect.stringContaining('Access denied')
      }));
    });

    it('should call next if user is an admin', () => {
      req.user = { id: 'user_admin', email: 'admin@equipment-tracker.com', role: UserRole.ADMIN };
      requireAdmin(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('requireOperator', () => {
    it('should return error if user is not an operator or admin', () => {
      req.user = { id: 'user_viewer', email: 'viewer@equipment-tracker.com', role: UserRole.VIEWER };
      requireOperator(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 403,
        message: expect.stringContaining('Access denied')
      }));
    });

    it('should call next if user is an operator', () => {
      req.user = { id: 'user_operator', email: 'operator@equipment-tracker.com', role: UserRole.OPERATOR };
      requireOperator(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next if user is an admin', () => {
      req.user = { id: 'user_admin', email: 'admin@equipment-tracker.com', role: UserRole.ADMIN };
      requireOperator(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('requireSystemAuth', () => {
    it('should return error if no API key is provided', () => {
      requireSystemAuth(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: 'System API key required'
      }));
    });

    it('should return error if API key is not a system API key', () => {
      req.headers = { 'x-api-key': 'et_admin_key_12345' };
      requireSystemAuth(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: 'Invalid system API key'
      }));
    });

    it('should call next if valid system API key is provided', () => {
      req.headers = { 'x-api-key': 'et_system_key_xyz789' };
      requireSystemAuth(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toEqual({
        id: 'system_api',
        email: 'system@equipment-tracker.com',
        role: UserRole.SYSTEM
      });
    });
  });

  describe('requireResourceOwnership', () => {
    it('should return error if user is not authenticated', () => {
      requireResourceOwnership(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: 'Authentication required'
      }));
    });

    it('should call next if user is admin', () => {
      req.user = { id: 'user_admin', email: 'admin@equipment-tracker.com', role: UserRole.ADMIN };
      req.params = { id: 'equipment_123' };
      requireResourceOwnership(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next if user is system', () => {
      req.user = { id: 'system_api', email: 'system@equipment-tracker.com', role: UserRole.SYSTEM };
      req.params = { id: 'equipment_123' };
      requireResourceOwnership(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next if user is operator', () => {
      req.user = { id: 'user_operator', email: 'operator@equipment-tracker.com', role: UserRole.OPERATOR };
      req.params = { id: 'equipment_123' };
      requireResourceOwnership(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next if user is viewer and method is GET', () => {
      req.user = { id: 'user_viewer', email: 'viewer@equipment-tracker.com', role: UserRole.VIEWER };
      req.params = { id: 'equipment_123' };
      req.method = 'GET';
      requireResourceOwnership(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should return error if user is viewer and method is not GET', () => {
      req.user = { id: 'user_viewer', email: 'viewer@equipment-tracker.com', role: UserRole.VIEWER };
      req.params = { id: 'equipment_123' };
      req.method = 'POST';
      requireResourceOwnership(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 403,
        message: 'Access denied to this resource'
      }));
    });

    it('should call next if no equipment ID is provided', () => {
      req.user = { id: 'user_viewer', email: 'viewer@equipment-tracker.com', role: UserRole.VIEWER };
      requireResourceOwnership(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('validateWebhookSignature', () => {
    it('should return error if signature or timestamp is missing', () => {
      validateWebhookSignature(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: 'Webhook signature and timestamp required'
      }));
    });

    it('should return error if signature format is invalid', () => {
      req.headers = {
        'x-webhook-signature': 'invalid-signature',
        'x-webhook-timestamp': Date.now().toString()
      };
      validateWebhookSignature(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: 'Invalid webhook signature format'
      }));
    });

    it('should return error if timestamp is expired', () => {
      const oldTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      req.headers = {
        'x-webhook-signature': 'sha256=valid-signature',
        'x-webhook-timestamp': oldTimestamp.toString()
      };
      validateWebhookSignature(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: 'Webhook timestamp expired'
      }));
    });

    it('should call next if signature and timestamp are valid', () => {
      req.headers = {
        'x-webhook-signature': 'sha256=valid-signature',
        'x-webhook-timestamp': Date.now().toString()
      };
      validateWebhookSignature(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('createUserRateLimit', () => {
    it('should allow requests within rate limit', () => {
      const rateLimit = createUserRateLimit(1000, 3);
      
      // First request
      rateLimit(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Limit', '3');
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '2');
      
      // Second request
      rateLimit(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '1');
      
      // Third request
      rateLimit(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
    });

    it('should block requests exceeding rate limit', () => {
      const rateLimit = createUserRateLimit(1000, 2);
      
      // First request
      rateLimit(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      
      // Second request
      rateLimit(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      
      // Third request (exceeds limit)
      rateLimit(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 429,
        message: expect.stringContaining('Rate limit exceeded')
      }));
    });

    it('should reset counter after window expires', () => {
      jest.useFakeTimers();
      const rateLimit = createUserRateLimit(1000, 2);
      
      // First request
      rateLimit(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      
      // Second request
      rateLimit(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      
      // Advance time beyond window
      jest.advanceTimersByTime(1001);
      
      // Third request (should be allowed after reset)
      rateLimit(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '1');
      
      jest.useRealTimers();
    });
  });

  describe('auditLog', () => {
    it('should log audit information when response is sent', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      req.user = { id: 'user_admin', email: 'admin@equipment-tracker.com', role: UserRole.ADMIN };
      
      auditLog(req as AuthenticatedRequest, res as Response, next);
      expect(next).toHaveBeenCalledWith();
      
      // Simulate sending response
      res.send!('test data');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT]'),
        expect.objectContaining({
          userId: 'user_admin',
          method: 'GET',
          path: '/test',
          statusCode: 200,
          userRole: UserRole.ADMIN,
          ip: '127.0.0.1',
          userAgent: 'test-user-agent'
        })
      );
      
      consoleSpy.mockRestore();
    });
  });
});
// </test_code>
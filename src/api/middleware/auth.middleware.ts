/* eslint-disable no-console */
/**
 * Authentication and Authorization Middleware
 * Handles API key authentication, JWT tokens, and role-based access control
 */

import { Request, Response, NextFunction } from 'express';
import { createError } from './error.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';

// User roles enum
export enum UserRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
  SYSTEM = 'system',
}

// Permission levels
export enum Permission {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin',
}

// Role permissions mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN],
  [UserRole.OPERATOR]: [Permission.READ, Permission.WRITE],
  [UserRole.VIEWER]: [Permission.READ],
  [UserRole.SYSTEM]: [Permission.READ, Permission.WRITE, Permission.DELETE],
};

// Mock user database (in production, this would be a real database)
interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  apiKey?: string;
  isActive: boolean;
  lastLogin?: Date;
  permissions?: Permission[];
}

const MOCK_USERS: User[] = [
  {
    id: 'user_admin',
    email: 'admin@equipment-tracker.com',
    name: 'System Administrator',
    role: UserRole.ADMIN,
    apiKey: 'et_admin_key_12345',
    isActive: true,
  },
  {
    id: 'user_operator',
    email: 'operator@equipment-tracker.com',
    name: 'Fleet Operator',
    role: UserRole.OPERATOR,
    apiKey: 'et_operator_key_67890',
    isActive: true,
  },
  {
    id: 'user_viewer',
    email: 'viewer@equipment-tracker.com',
    name: 'Fleet Viewer',
    role: UserRole.VIEWER,
    apiKey: 'et_viewer_key_abcdef',
    isActive: true,
  },
  {
    id: 'system_api',
    email: 'system@equipment-tracker.com',
    name: 'System API',
    role: UserRole.SYSTEM,
    apiKey: 'et_system_key_xyz789',
    isActive: true,
  },
];

/**
 * Find user by API key
 */
const findUserByApiKey = (apiKey: string): User | null => {
  return MOCK_USERS.find(user => user.apiKey === apiKey && user.isActive) ?? null;
};

/**
 * Find user by ID
 */
const findUserById = (id: string): User | null => {
  return MOCK_USERS.find(user => user.id === id && user.isActive) ?? null;
};

/**
 * Check if user has required permission
 */
const hasPermission = (user: User, permission: Permission): boolean => {
  const userPermissions = user.permissions ?? ROLE_PERMISSIONS[user.role] ?? [];
  return userPermissions.includes(permission);
};

/**
 * Extract API key from request headers
 */
const extractApiKey = (req: Request): string | null => {
  // Check Authorization header: "Bearer <api-key>" or "API-Key <api-key>"
  const authHeader = req.headers.authorization;
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    if (authHeader.startsWith('API-Key ')) {
      return authHeader.substring(8);
    }
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader && typeof apiKeyHeader === 'string') {
    return apiKeyHeader;
  }

  // Check query parameter (less secure, but useful for testing)
  const apiKeyQuery = req.query.apiKey;
  if (apiKeyQuery && typeof apiKeyQuery === 'string') {
    return apiKeyQuery;
  }

  return null;
};

/**
 * Basic authentication middleware
 * Validates API key and sets user context
 */
export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    return next(
      createError.unauthorized(
        'API key required. Provide via Authorization header, X-API-Key header, or apiKey query parameter',
      ),
    );
  }

  const user = findUserByApiKey(apiKey);

  if (!user) {
    return next(createError.unauthorized('Invalid API key'));
  }

  if (!user.isActive) {
    return next(createError.unauthorized('Account is deactivated'));
  }

  // Set user context
  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  // Update last login (in a real app, you'd update the database)
  user.lastLogin = new Date();

  next();
};

/**
 * Optional authentication middleware
 * Sets user context if API key is provided, but doesn't require it
 */
export const optionalAuthenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  const apiKey = extractApiKey(req);

  if (apiKey) {
    const user = findUserByApiKey(apiKey);
    if (user?.isActive) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
    }
  }

  next();
};

/**
 * Authorization middleware factory
 * Requires specific permission
 */
export const requirePermission = (permission: Permission) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError.unauthorized('Authentication required'));
    }

    const user = findUserById(req.user.id);
    if (!user) {
      return next(createError.unauthorized('User not found'));
    }

    if (!hasPermission(user, permission)) {
      return next(createError.forbidden(`Insufficient permissions. Required: ${permission}`));
    }

    next();
  };
};

/**
 * Role-based authorization middleware factory
 * Requires specific role
 */
export const requireRole = (role: UserRole) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError.unauthorized('Authentication required'));
    }

    if (req.user.role !== role) {
      return next(createError.forbidden(`Access denied. Required role: ${role}`));
    }

    next();
  };
};

/**
 * Multiple roles authorization middleware factory
 * Allows any of the specified roles
 */
export const requireAnyRole = (roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError.unauthorized('Authentication required'));
    }

    if (!roles.includes(req.user.role as UserRole)) {
      return next(createError.forbidden(`Access denied. Required roles: ${roles.join(', ')}`));
    }

    next();
  };
};

/**
 * Admin-only middleware
 */
export const requireAdmin = requireRole(UserRole.ADMIN);

/**
 * Operator or Admin middleware
 */
export const requireOperator = requireAnyRole([UserRole.OPERATOR, UserRole.ADMIN]);

/**
 * Any authenticated user middleware
 */
export const requireAuth = authenticate;

/**
 * System API key middleware (for internal services)
 */
export const requireSystemAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    return next(createError.unauthorized('System API key required'));
  }

  const user = findUserByApiKey(apiKey);

  if (!user || user.role !== UserRole.SYSTEM) {
    return next(createError.unauthorized('Invalid system API key'));
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  next();
};

/**
 * Resource ownership middleware
 * Ensures user can only access their own resources (for equipment-specific operations)
 */
export const requireResourceOwnership = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    return next(createError.unauthorized('Authentication required'));
  }

  // Admin and System users can access all resources
  if (req.user.role === UserRole.ADMIN || req.user.role === UserRole.SYSTEM) {
    return next();
  }

  // For equipment-specific routes, check ownership
  const equipmentId = req.params.id ?? req.params.equipmentId;
  if (equipmentId) {
    // In a real implementation, you'd check database for ownership
    // For now, we'll allow operators to access all equipment
    if (req.user.role === UserRole.OPERATOR) {
      return next();
    }

    // Viewers can only read, not modify
    const method = req.method.toUpperCase();
    if (req.user.role === UserRole.VIEWER && method === 'GET') {
      return next();
    }

    return next(createError.forbidden('Access denied to this resource'));
  }

  next();
};

/**
 * API key validation middleware for webhooks/external integrations
 */
export const validateWebhookSignature = (req: Request, res: Response, next: NextFunction): void => {
  const signature = req.headers['x-webhook-signature'] as string;
  const timestamp = req.headers['x-webhook-timestamp'] as string;

  if (!signature || !timestamp) {
    return next(createError.unauthorized('Webhook signature and timestamp required'));
  }

  // In a real implementation, you'd validate the HMAC signature
  // For demo purposes, we'll just check for a valid format
  if (!signature.startsWith('sha256=')) {
    return next(createError.unauthorized('Invalid webhook signature format'));
  }

  // Check timestamp to prevent replay attacks (5 minute window)
  const timestampNum = parseInt(timestamp);
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (Math.abs(now - timestampNum) > fiveMinutes) {
    return next(createError.unauthorized('Webhook timestamp expired'));
  }

  next();
};

/**
 * Rate limiting by user
 */
export const createUserRateLimit = (windowMs: number, maxRequests: number) => {
  const userRequests = new Map<string, { count: number; resetTime: number }>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userId = req.user?.id ?? req.ip ?? 'unknown';
    const now = Date.now();

    const userLimit = userRequests.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      // Reset or initialize counter
      userRequests.set(userId, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (userLimit.count >= maxRequests) {
      const resetInSeconds = Math.ceil((userLimit.resetTime - now) / 1000);
      res.set('X-RateLimit-Limit', maxRequests.toString());
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', userLimit.resetTime.toString());

      return next(
        createError.tooManyRequests(`Rate limit exceeded. Try again in ${resetInSeconds} seconds`),
      );
    }

    // Increment counter
    userLimit.count++;

    // Set rate limit headers
    res.set('X-RateLimit-Limit', maxRequests.toString());
    res.set('X-RateLimit-Remaining', (maxRequests - userLimit.count).toString());
    res.set('X-RateLimit-Reset', userLimit.resetTime.toString());

    next();
  };
};

/**
 * Audit logging middleware
 */
export const auditLog = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const originalSend = res.send;

  res.send = function (data): Response {
    // Log the action
    console.log(`[AUDIT] ${new Date().toISOString()}:`, {
      userId: req.user?.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      userRole: req.user?.role,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return originalSend.call(this, data);
  };

  next();
};

/* eslint-disable max-lines-per-function */
/* eslint-disable no-console */
/**
 * Rate Limiting Middleware
 * Advanced rate limiting with different strategies and IP/user-based limits
 */

import { Response, NextFunction } from 'express';
import { createError } from './error.middleware.js';
import type { AuthenticatedRequest, RateLimitConfig } from '../../types/index.js';

// Rate limit store interface
interface RateLimitStore {
  increment(key: string): Promise<{ totalHits: number; timeToExpire: number }>;
  decrement(key: string): Promise<void>;
  reset(key: string): Promise<void>;
  resetAll(): Promise<void>;
}

// In-memory rate limit store (in production, use Redis)
class MemoryStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  async increment(key: string): Promise<{ totalHits: number; timeToExpire: number }> {
    const now = Date.now();
    const current = this.store.get(key);

    if (!current || now > current.resetTime) {
      // Create new entry with 15-minute window
      const resetTime = now + 15 * 60 * 1000;
      this.store.set(key, { count: 1, resetTime });
      return { totalHits: 1, timeToExpire: resetTime - now };
    }

    // Increment existing entry
    current.count++;
    this.store.set(key, current);
    return { totalHits: current.count, timeToExpire: current.resetTime - now };
  }

  async decrement(key: string): Promise<void> {
    const current = this.store.get(key);
    if (current && current.count > 0) {
      current.count--;
      this.store.set(key, current);
    }
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async resetAll(): Promise<void> {
    this.store.clear();
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (now > value.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

// Global store instance
const defaultStore = new MemoryStore();

// Cleanup expired entries every 5 minutes
setInterval(
  () => {
    defaultStore.cleanup();
  },
  5 * 60 * 1000,
);

// Rate limit configurations
export const rateLimitConfigs = {
  // Standard API rate limiting
  standard: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    message: 'Too many requests, please try again later',
  },

  // Strict rate limiting for sensitive operations
  strict: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    message: 'Rate limit exceeded for sensitive operations',
  },

  // Bulk operations rate limiting
  bulk: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    skipSuccessfulRequests: false,
    skipFailedRequests: true,
    message: 'Bulk operation rate limit exceeded',
  },

  // Authentication attempts
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    skipSuccessfulRequests: true,
    skipFailedRequests: false,
    message: 'Too many authentication attempts',
  },

  // File upload rate limiting
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
    skipSuccessfulRequests: false,
    skipFailedRequests: true,
    message: 'Upload rate limit exceeded',
  },
};

/**
 * Generate rate limit key based on IP and user
 */
const generateKey = (req: AuthenticatedRequest, prefix: string): string => {
  const userId = req.user?.id;
  const ip = req.ip ?? req.connection.remoteAddress ?? 'unknown';

  // Use user ID if authenticated, otherwise use IP
  const identifier = userId ?? ip;
  return `${prefix}:${identifier}`;
};

/**
 * Rate limiting middleware factory
 */
export const createRateLimit = (config: RateLimitConfig, store: RateLimitStore = defaultStore) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = generateKey(req, 'rate_limit');
      const { totalHits, timeToExpire } = await store.increment(key);

      // Set rate limit headers
      res.set('X-RateLimit-Limit', config.maxRequests.toString());
      res.set('X-RateLimit-Remaining', Math.max(0, config.maxRequests - totalHits).toString());
      res.set('X-RateLimit-Reset', new Date(Date.now() + timeToExpire).toISOString());
      res.set('X-RateLimit-Policy', `${config.maxRequests};w=${config.windowMs}`);

      if (totalHits > config.maxRequests) {
        // Check if we should skip based on response status
        const shouldSkip =
          (config.skipSuccessfulRequests && res.statusCode < 400) ||
          (config.skipFailedRequests && res.statusCode >= 400);

        if (!shouldSkip) {
          const retryAfter = Math.ceil(timeToExpire / 1000);
          res.set('Retry-After', retryAfter.toString());

          return next(
            createError.tooManyRequests(
              `${config.message ?? 'Rate limit exceeded'}. Try again in ${retryAfter} seconds.`,
            ),
          );
        }
      }

      next();
    } catch (error) {
      // If rate limiting fails, don't block the request
      console.error('Rate limiting error:', error);
      next();
    }
  };
};

/**
 * Dynamic rate limiting based on user role
 */
export const createDynamicRateLimit = (baseConfig: RateLimitConfig) => {
  const roleMultipliers = {
    admin: 5, // 5x the base limit
    operator: 3, // 3x the base limit
    viewer: 1, // Base limit
    system: 10, // 10x the base limit (for internal services)
  };

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const userRole = req.user?.role ?? 'viewer';
    const multiplier = roleMultipliers[userRole as keyof typeof roleMultipliers] || 1;

    const dynamicConfig = {
      ...baseConfig,
      maxRequests: baseConfig.maxRequests * multiplier,
    };

    return createRateLimit(dynamicConfig)(req, res, next);
  };
};

/**
 * Endpoint-specific rate limiting
 */
export const endpointRateLimit = {
  // Standard API endpoints
  standard: createRateLimit(rateLimitConfigs.standard),

  // Strict rate limiting for sensitive operations
  strict: createRateLimit(rateLimitConfigs.strict),

  // Bulk operations
  bulk: createRateLimit(rateLimitConfigs.bulk),

  // Authentication endpoints
  auth: createRateLimit(rateLimitConfigs.auth),

  // File upload endpoints
  upload: createRateLimit(rateLimitConfigs.upload),

  // Dynamic rate limiting based on user role
  dynamic: createDynamicRateLimit(rateLimitConfigs.standard),
};

/**
 * Progressive rate limiting (increases penalty for repeated violations)
 */
export const createProgressiveRateLimit = (baseConfig: RateLimitConfig) => {
  const violationStore = new Map<string, { count: number; lastViolation: number }>();

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const key = generateKey(req, 'progressive');
    const violations = violationStore.get(key);

    // Calculate penalty multiplier based on violations
    let penaltyMultiplier = 1;
    if (violations) {
      const timeSinceLastViolation = Date.now() - violations.lastViolation;
      const hoursSince = timeSinceLastViolation / (1000 * 60 * 60);

      // Reset violations if more than 24 hours have passed
      if (hoursSince > 24) {
        violationStore.delete(key);
      } else {
        // Increase penalty: 2x for 1st violation, 4x for 2nd, 8x for 3rd, etc.
        penaltyMultiplier = Math.pow(2, Math.min(violations.count, 5));
      }
    }

    const adjustedConfig = {
      ...baseConfig,
      maxRequests: Math.floor(baseConfig.maxRequests / penaltyMultiplier),
    };

    const originalRateLimit = createRateLimit(adjustedConfig);

    // Wrap to track violations
    const wrappedRateLimit = async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        await originalRateLimit(req, res, error => {
          if (error && error.statusCode === 429) {
            // Record violation
            const current = violationStore.get(key) ?? { count: 0, lastViolation: 0 };
            violationStore.set(key, {
              count: current.count + 1,
              lastViolation: Date.now(),
            });
          }
          next(error);
        });
      } catch (error) {
        next(error);
      }
    };

    return wrappedRateLimit(req, res, next);
  };
};

/**
 * Sliding window rate limiter
 */
export const createSlidingWindowRateLimit = (maxRequests: number, windowMs: number) => {
  const requestLog = new Map<string, number[]>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const key = generateKey(req, 'sliding_window');
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing requests for this key
    const requests = requestLog.get(key) ?? [];

    // Remove requests outside the window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (validRequests.length >= maxRequests) {
      const oldestRequest = Math.min(...validRequests);
      const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);

      res.set('X-RateLimit-Limit', maxRequests.toString());
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', new Date(oldestRequest + windowMs).toISOString());
      res.set('Retry-After', retryAfter.toString());

      return next(
        createError.tooManyRequests(`Rate limit exceeded. Try again in ${retryAfter} seconds.`),
      );
    }

    // Add current request
    validRequests.push(now);
    requestLog.set(key, validRequests);

    // Set headers
    res.set('X-RateLimit-Limit', maxRequests.toString());
    res.set('X-RateLimit-Remaining', (maxRequests - validRequests.length).toString());
    res.set('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

    next();
  };
};

/**
 * Token bucket rate limiter
 */
export const createTokenBucketRateLimit = (
  capacity: number,
  refillRate: number,
  refillPeriod: number = 1000,
) => {
  const buckets = new Map<string, { tokens: number; lastRefill: number }>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const key = generateKey(req, 'token_bucket');
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: capacity, lastRefill: now };
      buckets.set(key, bucket);
    }

    // Refill tokens based on time passed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed / refillPeriod) * refillRate;

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Check if request can be processed
    if (bucket.tokens < 1) {
      const nextRefill = bucket.lastRefill + refillPeriod;
      const retryAfter = Math.ceil((nextRefill - now) / 1000);

      res.set('X-RateLimit-Limit', capacity.toString());
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', new Date(nextRefill).toISOString());
      res.set('Retry-After', retryAfter.toString());

      return next(
        createError.tooManyRequests(`Rate limit exceeded. Try again in ${retryAfter} seconds.`),
      );
    }

    // Consume token
    bucket.tokens -= 1;

    // Set headers
    res.set('X-RateLimit-Limit', capacity.toString());
    res.set('X-RateLimit-Remaining', bucket.tokens.toString());

    next();
  };
};

/**
 * Cleanup function for rate limit stores
 */
export const cleanupRateLimitStores = async (): Promise<void> => {
  await defaultStore.resetAll();
  console.log('[RateLimit] All rate limit stores cleaned up');
};

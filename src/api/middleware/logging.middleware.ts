/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable max-lines-per-function */
/**
 * Logging and Monitoring Middleware
 * Request logging, performance monitoring, and health checks
 */

import { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

// Log levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace',
}

// Request metrics interface - fixed to handle optional properties correctly
interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  timestamp: Date;
  userId?: string | undefined; // Explicitly allow undefined
  userRole?: string | undefined; // Explicitly allow undefined
  ip: string;
  userAgent: string;
  error?: string;
}

// Performance metrics store
class MetricsCollector {
  private metrics: RequestMetrics[] = [];
  private readonly maxMetrics = 10000; // Keep last 10k requests

  add(metric: RequestMetrics): void {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getMetrics(filter?: Partial<RequestMetrics>): RequestMetrics[] {
    if (!filter) {
      return [...this.metrics];
    }

    return this.metrics.filter(metric => {
      for (const [key, value] of Object.entries(filter)) {
        if (metric[key as keyof RequestMetrics] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  getStats(): {
    totalRequests: number;
    averageResponseTime: number;
    requestsByStatusCode: Record<number, number>;
    requestsByMethod: Record<string, number>;
    requestsByPath: Record<string, number>;
    errorRate: number;
    slowRequests: number; // Requests > 1000ms
  } {
    const total = this.metrics.length;
    if (total === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        requestsByStatusCode: {},
        requestsByMethod: {},
        requestsByPath: {},
        errorRate: 0,
        slowRequests: 0,
      };
    }

    const avgResponseTime = this.metrics.reduce((sum, m) => sum + m.responseTime, 0) / total;
    const errors = this.metrics.filter(m => m.statusCode >= 400).length;
    const slowRequests = this.metrics.filter(m => m.responseTime > 1000).length;

    const byStatusCode: Record<number, number> = {};
    const byMethod: Record<string, number> = {};
    const byPath: Record<string, number> = {};

    for (const metric of this.metrics) {
      byStatusCode[metric.statusCode] = (byStatusCode[metric.statusCode] ?? 0) + 1;
      byMethod[metric.method] = (byMethod[metric.method] ?? 0) + 1;
      byPath[metric.path] = (byPath[metric.path] ?? 0) + 1;
    }

    return {
      totalRequests: total,
      averageResponseTime: Math.round(avgResponseTime),
      requestsByStatusCode: byStatusCode,
      requestsByMethod: byMethod,
      requestsByPath: byPath,
      errorRate: Math.round((errors / total) * 100 * 100) / 100, // Round to 2 decimals
      slowRequests,
    };
  }

  clear(): void {
    this.metrics = [];
  }
}

// Global metrics collector
const metricsCollector = new MetricsCollector();

/**
 * Logger utility
 */
class Logger {
  private logLevel: LogLevel = LogLevel.INFO;
  private isDevelopment = process.env.NODE_ENV === 'development';

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG, LogLevel.TRACE];
    const currentIndex = levels.indexOf(this.logLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex <= currentIndex;
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  error(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message, meta));
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, meta));
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(LogLevel.INFO, message, meta));
    }
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, meta));
    }
  }

  trace(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      console.trace(this.formatMessage(LogLevel.TRACE, message, meta));
    }
  }
}

// Global logger instance
export const logger = new Logger();

/**
 * Request logging middleware
 */
export const requestLogger = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  // Generate request ID for tracking
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;

  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    userRole: req.user?.role,
  });

  // Override res.send to capture response data
  const originalSend = res.send;
  let responseSize = 0;

  res.send = function (data): Response {
    if (data) {
      responseSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
    }
    return originalSend.call(this, data);
  };

  // Handle response completion
  res.on('finish', () => {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const endMemory = process.memoryUsage();
    const memoryDiff = endMemory.heapUsed - startMemory.heapUsed;

    // Create metrics record - explicitly handle optional properties
    const metric: RequestMetrics = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime,
      requestSize: parseInt(req.get('content-length') ?? '0'),
      responseSize,
      timestamp: new Date(startTime),
      userId: req.user?.id, // This can be undefined
      userRole: req.user?.role, // This can be undefined
      ip: req.ip ?? 'unknown',
      userAgent: req.get('User-Agent') ?? 'unknown',
    };

    // Add error info if applicable
    if (res.statusCode >= 400) {
      metric.error = res.statusMessage || 'Unknown error';
    }

    // Store metrics
    metricsCollector.add(metric);

    // Log response
    const logLevel =
      res.statusCode >= 500
        ? LogLevel.ERROR
        : res.statusCode >= 400
          ? LogLevel.WARN
          : LogLevel.INFO;

    logger[logLevel]('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      requestSize: `${metric.requestSize}B`,
      responseSize: `${responseSize}B`,
      memoryDelta: `${Math.round(memoryDiff / 1024)}KB`,
      userId: req.user?.id,
      userRole: req.user?.role,
    });

    // Log slow requests
    if (responseTime > 1000) {
      logger.warn('Slow request detected', {
        requestId,
        method: req.method,
        path: req.path,
        responseTime: `${responseTime}ms`,
        userId: req.user?.id,
      });
    }
  });

  next();
};

/**
 * Error logging middleware
 */
export const errorLogger = (
  err: any,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  logger.error('Request error', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    ip: req.ip,
    statusCode: err.statusCode || 500,
  });

  next(err);
};

/**
 * Performance monitoring middleware
 */
export const performanceMonitor = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e6; // Convert to milliseconds
    const endMemory = process.memoryUsage();

    // Set performance headers
    res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
    res.set('X-Memory-Usage', `${Math.round(endMemory.heapUsed / 1024 / 1024)}MB`);

    // Alert on performance issues
    if (duration > 5000) {
      // 5 seconds
      logger.warn('Very slow request detected', {
        method: req.method,
        path: req.path,
        duration: `${duration.toFixed(2)}ms`,
        memoryUsed: `${Math.round(endMemory.heapUsed / 1024 / 1024)}MB`,
      });
    }

    // Alert on high memory usage
    if (endMemory.heapUsed > 500 * 1024 * 1024) {
      // 500MB
      logger.warn('High memory usage detected', {
        heapUsed: `${Math.round(endMemory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(endMemory.heapTotal / 1024 / 1024)}MB`,
        method: req.method,
        path: req.path,
      });
    }
  });

  next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Set security headers
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-Permitted-Cross-Domain-Policies', 'none');
  res.set('X-Download-Options', 'noopen');

  // HSTS for HTTPS
  if (req.secure) {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

/**
 * CORS middleware with logging
 */
export const corsWithLogging = (req: Request, res: Response, next: NextFunction): void => {
  const origin = req.get('Origin');

  // Log CORS requests
  if (origin) {
    logger.debug('CORS request', {
      method: req.method,
      origin,
      path: req.path,
    });
  }

  // Set CORS headers (customize as needed)
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://equipment-tracker.com',
    'https://app.equipment-tracker.com',
  ];

  if (origin && allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }

  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key',
  );
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    logger.debug('CORS preflight request', { origin, path: req.path });
    res.status(200).end();
  }

  next();
};

/**
 * Health check middleware
 */
export const healthCheck = (req: Request, res: Response, next: NextFunction): void => {
  // Basic health indicators
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    environment: process.env.NODE_ENV ?? 'development',
    nodeVersion: process.version,
    metrics: metricsCollector.getStats(),
  };

  // Check memory usage (alert if > 80% of available)
  const memoryUsagePercent = (health.memory.heapUsed / health.memory.heapTotal) * 100;
  if (memoryUsagePercent > 80) {
    health.status = 'warning';
    logger.warn('High memory usage in health check', {
      memoryUsagePercent: `${memoryUsagePercent.toFixed(2)}%`,
      heapUsed: `${Math.round(health.memory.heapUsed / 1024 / 1024)}MB`,
    });
  }

  // Check for high error rate
  const stats = health.metrics;
  if (stats.errorRate > 10) {
    // More than 10% error rate
    health.status = 'warning';
    logger.warn('High error rate detected', {
      errorRate: `${stats.errorRate}%`,
      totalRequests: stats.totalRequests,
    });
  }

  res.json(health);
};

/**
 * Request timeout middleware
 */
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout', {
          method: req.method,
          path: req.path,
          timeout: `${timeoutMs}ms`,
        });

        res.status(408).json({
          success: false,
          error: 'Request timeout',
          timeout: `${timeoutMs}ms`,
          timestamp: new Date(),
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

/**
 * Request size limiter middleware
 */
export const requestSizeLimit = (maxSizeBytes: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('content-length') ?? '0');

    if (contentLength > maxSizeBytes) {
      logger.warn('Request size limit exceeded', {
        method: req.method,
        path: req.path,
        contentLength: `${contentLength}B`,
        maxSize: `${maxSizeBytes}B`,
      });

      res.status(413).json({
        success: false,
        error: 'Request entity too large',
        maxSize: `${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
        actualSize: `${Math.round(contentLength / 1024 / 1024)}MB`,
        timestamp: new Date(),
      });
    }

    next();
  };
};

/**
 * API versioning middleware
 */
export const apiVersioning = (req: Request, res: Response, next: NextFunction): void => {
  // Extract version from header, query param, or URL
  const versionHeader = req.get('API-Version');
  const versionQuery = req.query.version as string;
  const versionUrl = req.path.match(/^\/api\/v(\d+)/)?.[1];

  const version = versionHeader ?? versionQuery ?? versionUrl ?? '1';

  // Set version in request for later use
  (req as any).apiVersion = version;

  // Set response header
  res.set('API-Version', version);

  logger.debug('API version detected', {
    version,
    method: req.method,
    path: req.path,
  });

  next();
};

/**
 * Request tracing middleware
 */
export const requestTracing = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  // Generate or extract trace ID
  const traceId =
    req.get('X-Trace-ID') ??
    req.get('X-Request-ID') ??
    `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Set trace ID in request and response
  req.traceId = traceId;
  res.set('X-Trace-ID', traceId);

  logger.debug('Request traced', {
    traceId,
    method: req.method,
    path: req.path,
  });

  next();
};

/**
 * Response compression info middleware
 */
export const compressionInfo = (req: Request, res: Response, next: NextFunction): void => {
  const originalSend = res.send;

  res.send = function (data): Response {
    const acceptEncoding = req.get('Accept-Encoding') ?? '';
    const contentEncoding = res.get('Content-Encoding');

    if (contentEncoding) {
      res.set('X-Compression', contentEncoding);
      logger.debug('Response compressed', {
        method: req.method,
        path: req.path,
        encoding: contentEncoding,
        originalSize: data ? Buffer.byteLength(JSON.stringify(data)) : 0,
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Get metrics endpoint handler
 */
export const getMetrics = (req: Request, res: Response): void => {
  const stats = metricsCollector.getStats();
  const systemMetrics = {
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    uptime: process.uptime(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  };

  res.json({
    success: true,
    data: {
      system: systemMetrics,
      requests: stats,
      timestamp: new Date(),
    },
  });
};

/**
 * Get recent logs endpoint handler
 */
export const getRecentLogs = (req: Request, res: Response): void => {
  const limit = parseInt(req.query.limit as string) || 100;
  const level = req.query.level as LogLevel;

  // Get recent metrics as proxy for logs
  let metrics = metricsCollector.getMetrics();

  if (level) {
    // Filter by severity (rough approximation)
    metrics = metrics.filter(m => {
      if (level === LogLevel.ERROR) {
        return m.statusCode >= 500;
      }
      if (level === LogLevel.WARN) {
        return m.statusCode >= 400;
      }
      return true;
    });
  }

  const recentLogs = metrics
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
    .map(m => ({
      timestamp: m.timestamp,
      level: m.statusCode >= 500 ? 'error' : m.statusCode >= 400 ? 'warn' : 'info',
      message: `${m.method} ${m.path} - ${m.statusCode}`,
      metadata: {
        method: m.method,
        path: m.path,
        statusCode: m.statusCode,
        responseTime: m.responseTime,
        userId: m.userId,
        ip: m.ip,
      },
    }));

  res.json({
    success: true,
    data: recentLogs,
    meta: {
      total: recentLogs.length,
      limit,
      level,
    },
    timestamp: new Date(),
  });
};

/**
 * Clear metrics endpoint handler
 */
export const clearMetrics = (req: Request, res: Response): void => {
  metricsCollector.clear();
  logger.info('Metrics cleared by user', {
    userId: (req as any).user?.id,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: 'Metrics cleared successfully',
    timestamp: new Date(),
  });
};

/**
 * Export metrics collector for external use
 */
export { metricsCollector };

/**
 * Middleware bundle for common logging setup
 */
export const loggingMiddleware = [
  requestTracing,
  requestLogger,
  performanceMonitor,
  securityHeaders,
  corsWithLogging,
];

/**
 * Development-only middleware
 */
export const developmentMiddleware = [
  ...loggingMiddleware,
  // Add more development-specific middleware here
];

/**
 * Production middleware
 */
export const productionMiddleware = [
  requestTimeout(30000), // 30 second timeout
  requestSizeLimit(10 * 1024 * 1024), // 10MB limit
  ...loggingMiddleware,
  compressionInfo,
];

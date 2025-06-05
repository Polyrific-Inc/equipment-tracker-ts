/**
 * Async Route Handler Utility
 * Wraps async route handlers to properly handle Promise rejections
 * This fixes the ESLint @typescript-eslint/no-misused-promises error
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async route handler to properly catch and forward errors
 * Usage: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = <T extends Request = Request, U extends Response = Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<void>,
) => {
  return (req: T, res: U, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Alternative async handler for routes that don't need next parameter
 * Usage: router.get('/', asyncRoute(async (req, res) => { ... }))
 */
export const asyncRoute = <T extends Request = Request, U extends Response = Response>(
  fn: (req: T, res: U) => Promise<void>,
) => {
  return (req: T, res: U, next: NextFunction): void => {
    Promise.resolve(fn(req, res)).catch(next);
  };
};

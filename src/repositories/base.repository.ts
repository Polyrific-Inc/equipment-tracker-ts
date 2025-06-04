/* eslint-disable brace-style */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/**
 * Base repository interface and abstract class
 */

import type { PaginationParams, PaginatedResponse, ValidationResult } from '../types/index.js';

/**
 * Base repository interface for common CRUD operations
 */
export interface IRepository<
  TEntity,
  TId,
  TCreateData = Partial<TEntity>,
  TUpdateData = Partial<TEntity>,
> {
  // Basic CRUD operations
  create(data: TCreateData): Promise<TEntity>;
  findById(id: TId): Promise<TEntity | null>;
  update(id: TId, data: TUpdateData): Promise<TEntity | null>;
  delete(id: TId): Promise<boolean>;

  // Bulk operations
  findAll(pagination?: PaginationParams): Promise<PaginatedResponse<TEntity>>;
  findMany(ids: TId[]): Promise<TEntity[]>;
  createMany(data: TCreateData[]): Promise<TEntity[]>;
  updateMany(updates: Array<{ id: TId; data: TUpdateData }>): Promise<TEntity[]>;
  deleteMany(ids: TId[]): Promise<number>;

  // Utility operations
  exists(id: TId): Promise<boolean>;
  count(): Promise<number>;
}

/**
 * Base repository with common implementations
 */
export abstract class BaseRepository<
  TEntity,
  TId,
  TCreateData = Partial<TEntity>,
  TUpdateData = Partial<TEntity>,
> implements IRepository<TEntity, TId, TCreateData, TUpdateData>
{
  protected abstract entityName: string;

  // Abstract methods that must be implemented by concrete repositories
  abstract create(data: TCreateData): Promise<TEntity>;
  abstract findById(id: TId): Promise<TEntity | null>;
  abstract update(id: TId, data: TUpdateData): Promise<TEntity | null>;
  abstract delete(id: TId): Promise<boolean>;
  abstract findAll(pagination?: PaginationParams): Promise<PaginatedResponse<TEntity>>;

  // Default implementations that can be overridden
  async findMany(ids: TId[]): Promise<TEntity[]> {
    const results: TEntity[] = [];

    for (const id of ids) {
      const entity = await this.findById(id);
      if (entity) {
        results.push(entity);
      }
    }

    return results;
  }

  async createMany(data: TCreateData[]): Promise<TEntity[]> {
    const results: TEntity[] = [];

    for (const item of data) {
      const entity = await this.create(item);
      results.push(entity);
    }

    return results;
  }

  async updateMany(updates: Array<{ id: TId; data: TUpdateData }>): Promise<TEntity[]> {
    const results: TEntity[] = [];

    for (const { id, data } of updates) {
      const entity = await this.update(id, data);
      if (entity) {
        results.push(entity);
      }
    }

    return results;
  }

  async deleteMany(ids: TId[]): Promise<number> {
    let deleteCount = 0;

    for (const id of ids) {
      const deleted = await this.delete(id);
      if (deleted) {
        deleteCount++;
      }
    }

    return deleteCount;
  }

  async exists(id: TId): Promise<boolean> {
    const entity = await this.findById(id);
    return entity !== null;
  }

  async count(): Promise<number> {
    const result = await this.findAll({ page: 1, limit: 1 });
    return result.pagination.total;
  }

  // Validation helpers
  protected validateRequired<T>(value: T | undefined | null, fieldName: string): ValidationResult {
    if (value === undefined || value === null) {
      return {
        isValid: false,
        errors: [`${fieldName} is required`],
      };
    }

    if (typeof value === 'string' && value.trim().length === 0) {
      return {
        isValid: false,
        errors: [`${fieldName} cannot be empty`],
      };
    }

    return { isValid: true, errors: [] };
  }

  protected validateId(id: TId): ValidationResult {
    return this.validateRequired(id, 'ID');
  }

  // Pagination helpers
  protected createPaginatedResponse<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponse<T> {
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: items,
      timestamp: new Date(),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  protected applyPagination<T>(items: T[], page: number, limit: number): T[] {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    return items.slice(startIndex, endIndex);
  }

  // Error handling helpers
  protected handleError(error: unknown, operation: string): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`${this.entityName} repository ${operation} failed: ${errorMessage}`);
  }

  protected logOperation(operation: string, details?: any): void {
    console.log(`[${this.entityName}Repository] ${operation}`, details || '');
  }
}

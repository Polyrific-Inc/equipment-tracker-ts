/* eslint-disable brace-style */
/* eslint-disable max-lines-per-function */
/* eslint-disable complexity */
/**
 * Position repository for GPS data persistence and querying
 */

import { BaseRepository } from './base.repository.js';
import { Position } from '../models/position.js';
import type {
  Position as IPosition,
  CreatePositionData,
  PositionQueryFilter,
  PositionSource,
  EquipmentId,
  PaginationParams,
  PaginatedResponse,
  TimeRange,
  GeographicBounds,
  Distance,
  Timestamp,
} from '../types/index.js';

/**
 * Position with metadata for storage
 */
interface StoredPosition extends IPosition {
  id: string;
  equipmentId: EquipmentId;
  source: PositionSource;
  speed?: number;
  heading?: number;
  satellites?: number;
}

/**
 * Extended interface for Position-specific operations
 */
export interface IPositionRepository
  extends BaseRepository<
    StoredPosition,
    string,
    CreatePositionData & { equipmentId: EquipmentId },
    Partial<StoredPosition>
  > {
  // Equipment-specific queries
  findByEquipmentId(
    equipmentId: EquipmentId,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<StoredPosition>>;
  findLatestByEquipmentId(equipmentId: EquipmentId): Promise<StoredPosition | null>;
  findByEquipmentIds(
    equipmentIds: EquipmentId[],
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<StoredPosition>>;

  // Time-based queries
  findInTimeRange(
    timeRange: TimeRange,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<StoredPosition>>;
  findByEquipmentInTimeRange(
    equipmentId: EquipmentId,
    timeRange: TimeRange,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<StoredPosition>>;

  // Geographic queries
  findInArea(
    bounds: GeographicBounds,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<StoredPosition>>;
  findNearPosition(
    latitude: number,
    longitude: number,
    radiusMeters: Distance,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<StoredPosition>>;

  // Advanced filtering
  findByFilter(
    filter: PositionQueryFilter,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<StoredPosition>>;

  // Analytics
  getPositionCount(equipmentId?: EquipmentId): Promise<number>;
  getLatestPositions(limit?: number): Promise<StoredPosition[]>;
  getPositionsByAccuracy(minAccuracy?: number, maxAccuracy?: number): Promise<StoredPosition[]>;

  // Cleanup operations
  deleteOlderThan(timestamp: Timestamp): Promise<number>;
  deleteByEquipmentId(equipmentId: EquipmentId): Promise<number>;
}

/**
 * In-memory implementation of Position Repository
 * In production, this would be replaced with a time-series database implementation
 */
export class PositionRepository
  extends BaseRepository<
    StoredPosition,
    string,
    CreatePositionData & { equipmentId: EquipmentId },
    Partial<StoredPosition>
  >
  implements IPositionRepository
{
  protected entityName = 'Position';
  private positionStore = new Map<string, StoredPosition>();
  private equipmentPositionIndex = new Map<EquipmentId, string[]>(); // Equipment ID -> Position IDs
  private nextId = 1;

  constructor() {
    super();
    this.initializeWithSampleData();
  }

  /**
   * Initialize with some sample data for development
   */
  private initializeWithSampleData(): void {
    const now = new Date();
    const samplePositions: Array<CreatePositionData & { equipmentId: EquipmentId }> = [
      {
        equipmentId: 'FORKLIFT-001',
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 10.0,
        accuracy: 2.5,
        timestamp: new Date(now.getTime() - 300000), // 5 minutes ago
      },
      {
        equipmentId: 'FORKLIFT-001',
        latitude: 37.775,
        longitude: -122.4195,
        altitude: 10.5,
        accuracy: 2.0,
        timestamp: new Date(now.getTime() - 240000), // 4 minutes ago
      },
      {
        equipmentId: 'CRANE-001',
        latitude: 37.7848,
        longitude: -122.4094,
        altitude: 25.0,
        accuracy: 1.5,
        timestamp: new Date(now.getTime() - 180000), // 3 minutes ago
      },
    ];

    // Create positions without awaiting (since this is initialization)
    for (const posData of samplePositions) {
      this.createSync(posData);
    }

    this.logOperation('initialized', `${samplePositions.length} sample positions`);
  }

  /**
   * Synchronous create for initialization
   */
  private createSync(data: CreatePositionData & { equipmentId: EquipmentId }): StoredPosition {
    const id = `pos_${this.nextId++}`;
    const position = new Position(data);

    const storedPosition: StoredPosition = {
      id,
      equipmentId: data.equipmentId,
      source: 'gps' as PositionSource, // Default source
      ...position.toJSON(),
    };

    this.positionStore.set(id, storedPosition);
    this.addToEquipmentIndex(data.equipmentId, id);

    return storedPosition;
  }

  async create(data: CreatePositionData & { equipmentId: EquipmentId }): Promise<StoredPosition> {
    try {
      // Validate data
      const validation = this.validateCreateData(data);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const storedPosition = this.createSync(data);

      this.logOperation('created', `${storedPosition.id} for equipment ${data.equipmentId}`);
      return storedPosition;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  async findById(id: string): Promise<StoredPosition | null> {
    try {
      const validation = this.validateId(id);
      if (!validation.isValid) {
        return null;
      }

      return this.positionStore.get(id) ?? null;
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  async update(id: string, data: Partial<StoredPosition>): Promise<StoredPosition | null> {
    try {
      const validation = this.validateId(id);
      if (!validation.isValid) {
        return null;
      }

      const existing = this.positionStore.get(id);
      if (!existing) {
        return null;
      }

      // Create updated position
      const updated: StoredPosition = { ...existing, ...data };
      this.positionStore.set(id, updated);

      this.logOperation('updated', id);
      return updated;
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const validation = this.validateId(id);
      if (!validation.isValid) {
        return false;
      }

      const position = this.positionStore.get(id);
      if (!position) {
        return false;
      }

      // Remove from main store
      const deleted = this.positionStore.delete(id);

      // Remove from equipment index
      if (deleted) {
        this.removeFromEquipmentIndex(position.equipmentId, id);
        this.logOperation('deleted', id);
      }

      return deleted;
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  async findAll(
    pagination: PaginationParams = { page: 1, limit: 20 },
  ): Promise<PaginatedResponse<StoredPosition>> {
    try {
      const allPositions = Array.from(this.positionStore.values());
      const total = allPositions.length;

      // Apply sorting (by timestamp, newest first)
      const sorted = allPositions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      const paginatedItems = this.applyPagination(sorted, pagination.page, pagination.limit);

      return this.createPaginatedResponse(paginatedItems, total, pagination.page, pagination.limit);
    } catch (error) {
      this.handleError(error, 'findAll');
    }
  }

  async findByEquipmentId(
    equipmentId: EquipmentId,
    pagination: PaginationParams = { page: 1, limit: 20 },
  ): Promise<PaginatedResponse<StoredPosition>> {
    try {
      const positionIds = this.equipmentPositionIndex.get(equipmentId) ?? [];
      const positions = positionIds
        .map(id => this.positionStore.get(id))
        .filter((pos): pos is StoredPosition => pos !== undefined)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Newest first

      const total = positions.length;
      const paginatedItems = this.applyPagination(positions, pagination.page, pagination.limit);

      return this.createPaginatedResponse(paginatedItems, total, pagination.page, pagination.limit);
    } catch (error) {
      this.handleError(error, 'findByEquipmentId');
    }
  }

  async findLatestByEquipmentId(equipmentId: EquipmentId): Promise<StoredPosition | null> {
    try {
      const result = await this.findByEquipmentId(equipmentId, { page: 1, limit: 1 });
      return result.data && result.data.length > 0 && result.data[0] ? result.data[0] : null;
    } catch (error) {
      this.handleError(error, 'findLatestByEquipmentId');
    }
  }

  async findByEquipmentIds(
    equipmentIds: EquipmentId[],
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<StoredPosition>> {
    try {
      const positions: StoredPosition[] = [];

      for (const equipmentId of equipmentIds) {
        const equipmentPositions = await this.findByEquipmentId(equipmentId, {
          page: 1,
          limit: 1000,
        });
        if (equipmentPositions.data) {
          positions.push(...equipmentPositions.data);
        }
      }

      // Sort by timestamp, newest first
      positions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const total = positions.length;
      const paginationParams = pagination ?? { page: 1, limit: 20 };
      const paginatedItems = this.applyPagination(
        positions,
        paginationParams.page,
        paginationParams.limit,
      );

      return this.createPaginatedResponse(
        paginatedItems,
        total,
        paginationParams.page,
        paginationParams.limit,
      );
    } catch (error) {
      this.handleError(error, 'findByEquipmentIds');
    }
  }

  async findInTimeRange(
    timeRange: TimeRange,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<StoredPosition>> {
    try {
      const positions = Array.from(this.positionStore.values())
        .filter(pos => pos.timestamp >= timeRange.start && pos.timestamp <= timeRange.end)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const total = positions.length;
      const paginationParams = pagination ?? { page: 1, limit: 20 };
      const paginatedItems = this.applyPagination(
        positions,
        paginationParams.page,
        paginationParams.limit,
      );

      return this.createPaginatedResponse(
        paginatedItems,
        total,
        paginationParams.page,
        paginationParams.limit,
      );
    } catch (error) {
      this.handleError(error, 'findInTimeRange');
    }
  }

  async findByEquipmentInTimeRange(
    equipmentId: EquipmentId,
    timeRange: TimeRange,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<StoredPosition>> {
    try {
      const positionIds = this.equipmentPositionIndex.get(equipmentId) ?? [];
      const positions = positionIds
        .map(id => this.positionStore.get(id))
        .filter((pos): pos is StoredPosition => pos !== undefined)
        .filter(pos => pos.timestamp >= timeRange.start && pos.timestamp <= timeRange.end)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const total = positions.length;
      const paginationParams = pagination ?? { page: 1, limit: 20 };
      const paginatedItems = this.applyPagination(
        positions,
        paginationParams.page,
        paginationParams.limit,
      );

      return this.createPaginatedResponse(
        paginatedItems,
        total,
        paginationParams.page,
        paginationParams.limit,
      );
    } catch (error) {
      this.handleError(error, 'findByEquipmentInTimeRange');
    }
  }

  async findInArea(
    bounds: GeographicBounds,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<StoredPosition>> {
    try {
      const positions = Array.from(this.positionStore.values())
        .filter(
          pos =>
            pos.latitude >= bounds.southWest.lat &&
            pos.latitude <= bounds.northEast.lat &&
            pos.longitude >= bounds.southWest.lng &&
            pos.longitude <= bounds.northEast.lng,
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const total = positions.length;
      const paginationParams = pagination ?? { page: 1, limit: 20 };
      const paginatedItems = this.applyPagination(
        positions,
        paginationParams.page,
        paginationParams.limit,
      );

      return this.createPaginatedResponse(
        paginatedItems,
        total,
        paginationParams.page,
        paginationParams.limit,
      );
    } catch (error) {
      this.handleError(error, 'findInArea');
    }
  }

  async findNearPosition(
    latitude: number,
    longitude: number,
    radiusMeters: Distance,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<StoredPosition>> {
    try {
      const centerPosition = new Position({ latitude, longitude });
      const positions = Array.from(this.positionStore.values())
        .filter(pos => {
          const posPosition = new Position(pos);
          return centerPosition.distanceTo(posPosition) <= radiusMeters;
        })
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const total = positions.length;
      const paginationParams = pagination ?? { page: 1, limit: 20 };
      const paginatedItems = this.applyPagination(
        positions,
        paginationParams.page,
        paginationParams.limit,
      );

      return this.createPaginatedResponse(
        paginatedItems,
        total,
        paginationParams.page,
        paginationParams.limit,
      );
    } catch (error) {
      this.handleError(error, 'findNearPosition');
    }
  }

  async findByFilter(
    filter: PositionQueryFilter,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<StoredPosition>> {
    try {
      let positions = Array.from(this.positionStore.values());

      // Apply filters
      positions = this.applyFilters(positions, filter);

      // Sort by timestamp, newest first
      positions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const total = positions.length;
      const paginationParams = pagination ?? { page: 1, limit: 20 };
      const paginatedItems = this.applyPagination(
        positions,
        paginationParams.page,
        paginationParams.limit,
      );

      this.logOperation('findByFilter', {
        filterCount: Object.keys(filter).length,
        resultCount: paginatedItems.length,
      });

      return this.createPaginatedResponse(
        paginatedItems,
        total,
        paginationParams.page,
        paginationParams.limit,
      );
    } catch (error) {
      this.handleError(error, 'findByFilter');
    }
  }

  async getPositionCount(equipmentId?: EquipmentId): Promise<number> {
    try {
      if (equipmentId) {
        const positionIds = this.equipmentPositionIndex.get(equipmentId) ?? [];
        return positionIds.length;
      }

      return this.positionStore.size;
    } catch (error) {
      this.handleError(error, 'getPositionCount');
    }
  }

  async getLatestPositions(limit = 10): Promise<StoredPosition[]> {
    try {
      const positions = Array.from(this.positionStore.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);

      return positions;
    } catch (error) {
      this.handleError(error, 'getLatestPositions');
    }
  }

  async getPositionsByAccuracy(
    minAccuracy?: number,
    maxAccuracy?: number,
  ): Promise<StoredPosition[]> {
    try {
      return Array.from(this.positionStore.values()).filter(pos => {
        if (minAccuracy !== undefined && pos.accuracy < minAccuracy) {
          return false;
        }
        if (maxAccuracy !== undefined && pos.accuracy > maxAccuracy) {
          return false;
        }
        return true;
      });
    } catch (error) {
      this.handleError(error, 'getPositionsByAccuracy');
    }
  }

  async deleteOlderThan(timestamp: Timestamp): Promise<number> {
    try {
      let deleteCount = 0;

      for (const [id, position] of this.positionStore.entries()) {
        if (position.timestamp < timestamp) {
          await this.delete(id);
          deleteCount++;
        }
      }

      this.logOperation('deleteOlderThan', `${deleteCount} positions deleted`);
      return deleteCount;
    } catch (error) {
      this.handleError(error, 'deleteOlderThan');
    }
  }

  async deleteByEquipmentId(equipmentId: EquipmentId): Promise<number> {
    try {
      const positionIds = this.equipmentPositionIndex.get(equipmentId) ?? [];
      let deleteCount = 0;

      for (const id of positionIds) {
        const deleted = await this.delete(id);
        if (deleted) {
          deleteCount++;
        }
      }

      this.logOperation(
        'deleteByEquipmentId',
        `${deleteCount} positions deleted for equipment ${equipmentId}`,
      );
      return deleteCount;
    } catch (error) {
      this.handleError(error, 'deleteByEquipmentId');
    }
  }

  // Private helper methods
  private validateCreateData(data: CreatePositionData & { equipmentId: EquipmentId }): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!data.equipmentId || data.equipmentId.trim().length === 0) {
      errors.push('Equipment ID is required');
    }

    if (typeof data.latitude !== 'number' || data.latitude < -90 || data.latitude > 90) {
      errors.push('Valid latitude is required (-90 to 90)');
    }

    if (typeof data.longitude !== 'number' || data.longitude < -180 || data.longitude > 180) {
      errors.push('Valid longitude is required (-180 to 180)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private applyFilters(positions: StoredPosition[], filter: PositionQueryFilter): StoredPosition[] {
    return positions.filter(pos => {
      // Equipment ID filter
      if (filter.equipmentId) {
        const equipmentIds = Array.isArray(filter.equipmentId)
          ? filter.equipmentId
          : [filter.equipmentId];
        if (!equipmentIds.includes(pos.equipmentId)) {
          return false;
        }
      }

      // Time range filter
      if (filter.timeRange) {
        if (pos.timestamp < filter.timeRange.start || pos.timestamp > filter.timeRange.end) {
          return false;
        }
      }

      // Geographic bounds filter
      if (filter.bounds) {
        if (
          pos.latitude < filter.bounds.southWest.lat ||
          pos.latitude > filter.bounds.northEast.lat ||
          pos.longitude < filter.bounds.southWest.lng ||
          pos.longitude > filter.bounds.northEast.lng
        ) {
          return false;
        }
      }

      // Accuracy filters
      if (filter.minAccuracy !== undefined && pos.accuracy < filter.minAccuracy) {
        return false;
      }
      if (filter.maxAccuracy !== undefined && pos.accuracy > filter.maxAccuracy) {
        return false;
      }

      // Source filter
      if (filter.source) {
        const sources = Array.isArray(filter.source) ? filter.source : [filter.source];
        if (!sources.includes(pos.source)) {
          return false;
        }
      }

      // Speed filters
      if (filter.hasSpeed !== undefined) {
        const hasSpeed = pos.speed !== undefined;
        if (hasSpeed !== filter.hasSpeed) {
          return false;
        }
      }

      if (
        filter.minSpeed !== undefined &&
        (pos.speed === undefined || pos.speed < filter.minSpeed)
      ) {
        return false;
      }
      if (
        filter.maxSpeed !== undefined &&
        (pos.speed === undefined || pos.speed > filter.maxSpeed)
      ) {
        return false;
      }

      return true;
    });
  }

  private addToEquipmentIndex(equipmentId: EquipmentId, positionId: string): void {
    const existing = this.equipmentPositionIndex.get(equipmentId) ?? [];
    existing.push(positionId);
    this.equipmentPositionIndex.set(equipmentId, existing);
  }

  private removeFromEquipmentIndex(equipmentId: EquipmentId, positionId: string): void {
    const existing = this.equipmentPositionIndex.get(equipmentId) ?? [];
    const filtered = existing.filter(id => id !== positionId);

    if (filtered.length === 0) {
      this.equipmentPositionIndex.delete(equipmentId);
    } else {
      this.equipmentPositionIndex.set(equipmentId, filtered);
    }
  }
}

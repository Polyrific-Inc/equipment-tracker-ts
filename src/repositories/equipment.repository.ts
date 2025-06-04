/* eslint-disable brace-style */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-lines-per-function */
/* eslint-disable complexity */
/**
 * Equipment repository for data persistence and querying
 */

import { BaseRepository } from './base.repository.js';
import { Equipment } from '../models/equipment.js';
import type {
  IEquipment,
  EquipmentId,
  CreateEquipmentData,
  UpdateEquipmentData,
  EquipmentQueryFilter,
  EquipmentType,
  EquipmentStatus,
  PaginationParams,
  PaginatedResponse,
  Timestamp,
  GeographicBounds,
} from '../types/index.js';

/**
 * Extended interface for Equipment-specific operations
 */
export interface IEquipmentRepository
  extends BaseRepository<IEquipment, EquipmentId, CreateEquipmentData, UpdateEquipmentData> {
  // Query methods
  findByFilter(
    filter: EquipmentQueryFilter,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<IEquipment>>;
  findByType(
    type: EquipmentType,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<IEquipment>>;
  findByStatus(
    status: EquipmentStatus,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<IEquipment>>;
  findActive(pagination?: PaginationParams): Promise<PaginatedResponse<IEquipment>>;
  findInArea(
    bounds: GeographicBounds,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<IEquipment>>;

  // Statistics
  getTypeStatistics(): Promise<Record<EquipmentType, number>>;
  getStatusStatistics(): Promise<Record<EquipmentStatus, number>>;
  countByStatus(status: EquipmentStatus): Promise<number>;
  countByType(type: EquipmentType): Promise<number>;

  // Maintenance
  findDueForMaintenance(): Promise<IEquipment[]>;
  findInactiveEquipment(inactiveSince: Timestamp): Promise<IEquipment[]>;
}

/**
 * In-memory implementation of Equipment Repository
 * In production, this would be replaced with a database implementation
 */
export class EquipmentRepository
  extends BaseRepository<IEquipment, EquipmentId, CreateEquipmentData, UpdateEquipmentData>
  implements IEquipmentRepository
{
  protected entityName = 'Equipment';
  private equipmentStore = new Map<EquipmentId, Equipment>();
  private nextId = 1;

  constructor() {
    super();
    this.initializeWithSampleData();
  }

  /**
   * Initialize with some sample data for development
   */
  private initializeWithSampleData(): void {
    const sampleEquipment = [
      new Equipment({
        id: 'FORKLIFT-001',
        type: 'forklift' as EquipmentType,
        name: 'Warehouse Forklift Alpha',
        status: 'active' as EquipmentStatus,
      }),
      new Equipment({
        id: 'CRANE-001',
        type: 'crane' as EquipmentType,
        name: 'Tower Crane Beta',
        status: 'active' as EquipmentStatus,
      }),
      new Equipment({
        id: 'BULLDOZER-001',
        type: 'bulldozer' as EquipmentType,
        name: 'Heavy Bulldozer Gamma',
        status: 'maintenance' as EquipmentStatus,
      }),
    ];

    for (const equipment of sampleEquipment) {
      this.equipmentStore.set(equipment.id, equipment);
    }

    this.logOperation('initialized', `${sampleEquipment.length} sample equipment items`);
  }

  async create(data: CreateEquipmentData): Promise<IEquipment> {
    try {
      // Validate data
      const validation = this.validateCreateData(data);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if equipment already exists
      if (await this.exists(data.id)) {
        throw new Error(`Equipment with ID ${data.id} already exists`);
      }

      // Create equipment
      const equipment = new Equipment(data);
      this.equipmentStore.set(equipment.id, equipment);

      this.logOperation('created', equipment.id);
      return equipment.toJSON();
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  async findById(id: EquipmentId): Promise<IEquipment | null> {
    try {
      const validation = this.validateId(id);
      if (!validation.isValid) {
        return null;
      }

      const equipment = this.equipmentStore.get(id);
      return equipment ? equipment.toJSON() : null;
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  async update(id: EquipmentId, data: UpdateEquipmentData): Promise<IEquipment | null> {
    try {
      const validation = this.validateId(id);
      if (!validation.isValid) {
        return null;
      }

      const equipment = this.equipmentStore.get(id);
      if (!equipment) {
        return null;
      }

      // Update equipment
      equipment.update(data);

      this.logOperation('updated', id);
      return equipment.toJSON();
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  async delete(id: EquipmentId): Promise<boolean> {
    try {
      const validation = this.validateId(id);
      if (!validation.isValid) {
        return false;
      }

      const deleted = this.equipmentStore.delete(id);

      if (deleted) {
        this.logOperation('deleted', id);
      }

      return deleted;
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  async findAll(
    pagination: PaginationParams = { page: 1, limit: 20 },
  ): Promise<PaginatedResponse<IEquipment>> {
    try {
      const allEquipment = Array.from(this.equipmentStore.values());
      const total = allEquipment.length;

      // Apply sorting
      const sorted = this.applySorting(allEquipment, pagination);

      // Apply pagination
      const paginatedItems = this.applyPagination(sorted, pagination.page, pagination.limit);

      // Convert to JSON
      const items = paginatedItems.map(eq => eq.toJSON());

      return this.createPaginatedResponse(items, total, pagination.page, pagination.limit);
    } catch (error) {
      this.handleError(error, 'findAll');
    }
  }

  async findByFilter(
    filter: EquipmentQueryFilter,
    pagination: PaginationParams = { page: 1, limit: 20 },
  ): Promise<PaginatedResponse<IEquipment>> {
    try {
      let equipment = Array.from(this.equipmentStore.values());

      // Apply filters
      equipment = this.applyFilters(equipment, filter);

      const total = equipment.length;

      // Apply sorting
      const sorted = this.applySorting(equipment, pagination);

      // Apply pagination
      const paginatedItems = this.applyPagination(sorted, pagination.page, pagination.limit);

      // Convert to JSON
      const items = paginatedItems.map(eq => eq.toJSON());

      this.logOperation('findByFilter', {
        filterCount: Object.keys(filter).length,
        resultCount: items.length,
      });

      return this.createPaginatedResponse(items, total, pagination.page, pagination.limit);
    } catch (error) {
      this.handleError(error, 'findByFilter');
    }
  }

  async findByType(
    type: EquipmentType,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<IEquipment>> {
    return this.findByFilter({ type }, pagination);
  }

  async findByStatus(
    status: EquipmentStatus,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<IEquipment>> {
    return this.findByFilter({ status }, pagination);
  }

  async findActive(pagination?: PaginationParams): Promise<PaginatedResponse<IEquipment>> {
    return this.findByStatus('active' as EquipmentStatus, pagination);
  }

  async findInArea(
    bounds: GeographicBounds,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<IEquipment>> {
    try {
      const equipment = Array.from(this.equipmentStore.values()).filter(eq => {
        const lastPos = eq.lastPosition;
        if (!lastPos) {
          return false;
        }

        return (
          lastPos.latitude >= bounds.southWest.lat &&
          lastPos.latitude <= bounds.northEast.lat &&
          lastPos.longitude >= bounds.southWest.lng &&
          lastPos.longitude <= bounds.northEast.lng
        );
      });

      const total = equipment.length;
      const paginationParams = pagination ?? { page: 1, limit: 20 };

      // Apply sorting and pagination
      const sorted = this.applySorting(equipment, paginationParams);
      const paginatedItems = this.applyPagination(
        sorted,
        paginationParams.page,
        paginationParams.limit,
      );

      // Convert to JSON
      const items = paginatedItems.map(eq => eq.toJSON());

      return this.createPaginatedResponse(
        items,
        total,
        paginationParams.page,
        paginationParams.limit,
      );
    } catch (error) {
      this.handleError(error, 'findInArea');
    }
  }

  async getTypeStatistics(): Promise<Record<EquipmentType, number>> {
    try {
      const stats: Record<string, number> = {};

      for (const equipment of this.equipmentStore.values()) {
        const type = equipment.type;
        stats[type] = (stats[type] ?? 0) + 1;
      }

      return stats as Record<EquipmentType, number>;
    } catch (error) {
      this.handleError(error, 'getTypeStatistics');
    }
  }

  async getStatusStatistics(): Promise<Record<EquipmentStatus, number>> {
    try {
      const stats: Record<string, number> = {};

      for (const equipment of this.equipmentStore.values()) {
        const status = equipment.status;
        stats[status] = (stats[status] ?? 0) + 1;
      }

      return stats as Record<EquipmentStatus, number>;
    } catch (error) {
      this.handleError(error, 'getStatusStatistics');
    }
  }

  async countByStatus(status: EquipmentStatus): Promise<number> {
    try {
      let count = 0;
      for (const equipment of this.equipmentStore.values()) {
        if (equipment.status === status) {
          count++;
        }
      }
      return count;
    } catch (error) {
      this.handleError(error, 'countByStatus');
    }
  }

  async countByType(type: EquipmentType): Promise<number> {
    try {
      let count = 0;
      for (const equipment of this.equipmentStore.values()) {
        if (equipment.type === type) {
          count++;
        }
      }
      return count;
    } catch (error) {
      this.handleError(error, 'countByType');
    }
  }

  async findDueForMaintenance(): Promise<IEquipment[]> {
    try {
      // This is a simplified implementation
      // In a real system, this would check maintenance schedules, usage hours, etc.
      const equipment = Array.from(this.equipmentStore.values())
        .filter(eq => eq.status === ('maintenance' as EquipmentStatus))
        .map(eq => eq.toJSON());

      return equipment;
    } catch (error) {
      this.handleError(error, 'findDueForMaintenance');
    }
  }

  async findInactiveEquipment(inactiveSince: Timestamp): Promise<IEquipment[]> {
    try {
      const equipment = Array.from(this.equipmentStore.values())
        .filter(eq => {
          const lastPos = eq.lastPosition;
          if (!lastPos) {
            return true;
          } // No position = inactive

          return lastPos.timestamp < inactiveSince;
        })
        .map(eq => eq.toJSON());

      return equipment;
    } catch (error) {
      this.handleError(error, 'findInactiveEquipment');
    }
  }

  // Private helper methods
  private validateCreateData(data: CreateEquipmentData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.id || data.id.trim().length === 0) {
      errors.push('Equipment ID is required');
    }

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Equipment name is required');
    }

    if (!data.type) {
      errors.push('Equipment type is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private applyFilters(equipment: Equipment[], filter: EquipmentQueryFilter): Equipment[] {
    return equipment.filter(eq => {
      // Type filter
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        if (!types.includes(eq.type)) {
          return false;
        }
      }

      // Status filter
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        if (!statuses.includes(eq.status)) {
          return false;
        }
      }

      // Date filters
      if (filter.createdAfter && eq.createdAt < filter.createdAfter) {
        return false;
      }
      if (filter.createdBefore && eq.createdAt > filter.createdBefore) {
        return false;
      }
      if (filter.updatedAfter && eq.updatedAt < filter.updatedAfter) {
        return false;
      }
      if (filter.updatedBefore && eq.updatedAt > filter.updatedBefore) {
        return false;
      }

      // Position filter
      if (filter.hasPosition !== undefined) {
        const hasPosition = !!eq.lastPosition;
        if (hasPosition !== filter.hasPosition) {
          return false;
        }
      }

      // Movement filter
      if (filter.isMoving !== undefined) {
        const isMoving = eq.isMoving();
        if (isMoving !== filter.isMoving) {
          return false;
        }
      }

      return true;
    });
  }

  private applySorting(equipment: Equipment[], pagination: PaginationParams): Equipment[] {
    if (!pagination.sortBy) {
      return equipment.sort((a, b) => a.name.localeCompare(b.name)); // Default sort by name
    }

    return equipment.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (pagination.sortBy) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'createdAt':
          aValue = a.createdAt;
          bValue = b.createdAt;
          break;
        case 'updatedAt':
          aValue = a.updatedAt;
          bValue = b.updatedAt;
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (typeof aValue === 'string') {
        const result = aValue.localeCompare(bValue);
        return pagination.sortOrder === 'desc' ? -result : result;
      } else {
        const result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return pagination.sortOrder === 'desc' ? -result : result;
      }
    });
  }
}

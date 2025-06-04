/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable max-lines-per-function */
/**
 * Equipment Service - Business logic for equipment management
 */

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
  Position,
  MovementAnalysis,
  FleetStats,
  GeographicBounds,
  Timestamp,
} from '../types/index.js';
import type { IEquipmentRepository } from '../repositories/equipment.repository.js';
import type { IPositionRepository } from '../repositories/position.repository.js';
import { Equipment } from '../models/equipment.js';

export interface IEquipmentService {
  // Core equipment management
  createEquipment(data: CreateEquipmentData): Promise<IEquipment>;
  getEquipment(id: EquipmentId): Promise<IEquipment>;
  updateEquipment(id: EquipmentId, data: UpdateEquipmentData): Promise<IEquipment>;
  deleteEquipment(id: EquipmentId): Promise<void>;

  // Equipment queries
  getAllEquipment(pagination?: PaginationParams): Promise<PaginatedResponse<IEquipment>>;
  findEquipment(
    filter: EquipmentQueryFilter,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<IEquipment>>;
  getEquipmentByType(
    type: EquipmentType,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<IEquipment>>;
  getEquipmentByStatus(
    status: EquipmentStatus,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<IEquipment>>;
  getActiveEquipment(pagination?: PaginationParams): Promise<PaginatedResponse<IEquipment>>;
  getEquipmentInArea(
    bounds: GeographicBounds,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<IEquipment>>;

  // Position management
  updateEquipmentPosition(id: EquipmentId, position: Position): Promise<void>;
  getEquipmentPositions(
    id: EquipmentId,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<Position>>;
  getEquipmentMovementAnalysis(
    id: EquipmentId,
    timeRange?: { start: Timestamp; end: Timestamp },
  ): Promise<MovementAnalysis>;

  // Fleet management
  getFleetStatistics(): Promise<FleetStats>;
  getDashboardSummary(): Promise<{
    totalEquipment: number;
    activeEquipment: number;
    movingEquipment: number;
    maintenanceEquipment: number;
    recentActivity: IEquipment[];
    alerts: string[];
  }>;

  // Maintenance and alerts
  getMaintenanceDue(): Promise<IEquipment[]>;
  getInactiveEquipment(inactiveSince: Timestamp): Promise<IEquipment[]>;
  checkEquipmentHealth(id: EquipmentId): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  }>;
}

export class EquipmentService implements IEquipmentService {
  constructor(
    private equipmentRepository: IEquipmentRepository,
    private positionRepository: IPositionRepository,
  ) {}

  async createEquipment(data: CreateEquipmentData): Promise<IEquipment> {
    try {
      // Additional business logic validation
      await this.validateEquipmentCreation(data);

      const equipment = await this.equipmentRepository.create(data);

      console.log(`[EquipmentService] Created equipment: ${equipment.id}`);
      return equipment;
    } catch (error) {
      console.error('[EquipmentService] Failed to create equipment:', error);
      throw error;
    }
  }

  async getEquipment(id: EquipmentId): Promise<IEquipment> {
    const equipment = await this.equipmentRepository.findById(id);

    if (!equipment) {
      throw new Error(`Equipment with ID ${id} not found`);
    }

    return equipment;
  }

  async updateEquipment(id: EquipmentId, data: UpdateEquipmentData): Promise<IEquipment> {
    try {
      // Check if equipment exists
      await this.getEquipment(id);

      const updated = await this.equipmentRepository.update(id, data);

      if (!updated) {
        throw new Error(`Failed to update equipment ${id}`);
      }

      console.log(`[EquipmentService] Updated equipment: ${id}`);
      return updated;
    } catch (error) {
      console.error(`[EquipmentService] Failed to update equipment ${id}:`, error);
      throw error;
    }
  }

  async deleteEquipment(id: EquipmentId): Promise<void> {
    try {
      // Check if equipment exists
      await this.getEquipment(id);

      // Delete associated position data
      await this.positionRepository.deleteByEquipmentId(id);

      // Delete equipment
      const deleted = await this.equipmentRepository.delete(id);

      if (!deleted) {
        throw new Error(`Failed to delete equipment ${id}`);
      }

      console.log(`[EquipmentService] Deleted equipment: ${id}`);
    } catch (error) {
      console.error(`[EquipmentService] Failed to delete equipment ${id}:`, error);
      throw error;
    }
  }

  async getAllEquipment(pagination?: PaginationParams): Promise<PaginatedResponse<IEquipment>> {
    return this.equipmentRepository.findAll(pagination);
  }

  async findEquipment(
    filter: EquipmentQueryFilter,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<IEquipment>> {
    return this.equipmentRepository.findByFilter(filter, pagination);
  }

  async getEquipmentByType(
    type: EquipmentType,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<IEquipment>> {
    return this.equipmentRepository.findByType(type, pagination);
  }

  async getEquipmentByStatus(
    status: EquipmentStatus,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<IEquipment>> {
    return this.equipmentRepository.findByStatus(status, pagination);
  }

  async getActiveEquipment(pagination?: PaginationParams): Promise<PaginatedResponse<IEquipment>> {
    return this.equipmentRepository.findActive(pagination);
  }

  async getEquipmentInArea(
    bounds: GeographicBounds,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<IEquipment>> {
    return this.equipmentRepository.findInArea(bounds, pagination);
  }

  async updateEquipmentPosition(id: EquipmentId, position: Position): Promise<void> {
    try {
      // Get equipment to ensure it exists
      const equipment = await this.getEquipment(id);

      // Create position record
      await this.positionRepository.create({
        equipmentId: id,
        latitude: position.latitude,
        longitude: position.longitude,
        altitude: position.altitude,
        accuracy: position.accuracy,
        timestamp: position.timestamp,
      });

      // Update equipment's last position (if using domain model)
      // This would typically be handled by the repository layer in a real implementation

      console.log(`[EquipmentService] Updated position for equipment: ${id}`);
    } catch (error) {
      console.error(`[EquipmentService] Failed to update position for equipment ${id}:`, error);
      throw error;
    }
  }

  async getEquipmentPositions(
    id: EquipmentId,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<Position>> {
    // Ensure equipment exists
    await this.getEquipment(id);

    const result = await this.positionRepository.findByEquipmentId(id, pagination);

    // Convert stored positions to Position interface
    const positions =
      result.data?.map(pos => ({
        latitude: pos.latitude,
        longitude: pos.longitude,
        altitude: pos.altitude,
        accuracy: pos.accuracy,
        timestamp: pos.timestamp,
        distanceTo(other: Position): number {
          // Simple distance calculation using Euclidean distance (for demonstration)
          // In a real implementation, you would use a more accurate formula like Haversine
          const latDiff = this.latitude - other.latitude;
          const lonDiff = this.longitude - other.longitude;
          return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
        },
      })) ?? [];

    return {
      ...result,
      data: positions,
    };
  }

  async getEquipmentMovementAnalysis(
    id: EquipmentId,
    timeRange?: { start: Timestamp; end: Timestamp },
  ): Promise<MovementAnalysis> {
    // Ensure equipment exists
    await this.getEquipment(id);

    // Get positions for analysis
    const positions = timeRange
      ? await this.positionRepository.findByEquipmentInTimeRange(id, timeRange, {
          page: 1,
          limit: 1000,
        })
      : await this.positionRepository.findByEquipmentId(id, { page: 1, limit: 1000 });

    if (!positions.data || positions.data.length < 2) {
      return {
        isMoving: false,
        totalDistance: 0,
        movingTime: 0,
        stoppedTime: 0,
      };
    }

    // Create Equipment instance for movement analysis
    const equipment = new Equipment({
      id,
      type: 'other' as EquipmentType, // Temporary, as we just need movement analysis
      name: 'Analysis',
    });

    // Add positions to equipment for analysis
    for (const pos of positions.data) {
      equipment.recordPosition({
        latitude: pos.latitude,
        longitude: pos.longitude,
        altitude: pos.altitude,
        accuracy: pos.accuracy,
        timestamp: pos.timestamp,
        distanceTo(lastPosition: Position): unknown {
          throw new Error('Function not implemented.');
        },
      });
    }

    return equipment.analyzeMovement(timeRange);
  }

  async getFleetStatistics(): Promise<FleetStats> {
    try {
      const [typeStats, statusStats, totalCount] = await Promise.all([
        this.equipmentRepository.getTypeStatistics(),
        this.equipmentRepository.getStatusStatistics(),
        this.equipmentRepository.count(),
      ]);

      const activeCount = statusStats.active || 0;
      const inactiveCount = statusStats.inactive || 0;
      const maintenanceCount = statusStats.maintenance || 0;
      const unknownCount = statusStats.unknown || 0;

      // Calculate total distance and operating time (simplified)
      const totalDistance = await this.calculateFleetTotalDistance();
      const totalOperatingTime = await this.calculateFleetOperatingTime();

      const averageUtilization = totalCount > 0 ? (activeCount / totalCount) * 100 : 0;

      return {
        totalEquipment: totalCount,
        activeEquipment: activeCount,
        inactiveEquipment: inactiveCount,
        maintenanceEquipment: maintenanceCount,
        unknownEquipment: unknownCount,
        totalDistance,
        totalOperatingTime,
        averageUtilization,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('[EquipmentService] Failed to get fleet statistics:', error);
      throw error;
    }
  }

  async getDashboardSummary(): Promise<{
    totalEquipment: number;
    activeEquipment: number;
    movingEquipment: number;
    maintenanceEquipment: number;
    recentActivity: IEquipment[];
    alerts: string[];
  }> {
    try {
      const [fleetStats, recentPositions, maintenanceDue] = await Promise.all([
        this.getFleetStatistics(),
        this.positionRepository.getLatestPositions(10),
        this.getMaintenanceDue(),
      ]);

      // Get recent activity (equipment with recent positions)
      const recentEquipmentIds = [...new Set(recentPositions.map(pos => pos.equipmentId))];
      const recentActivity = await this.equipmentRepository.findMany(recentEquipmentIds);

      // Count moving equipment (simplified - equipment with recent position updates)
      const movingEquipment = recentActivity.length;

      // Generate alerts
      const alerts: string[] = [];
      if (maintenanceDue.length > 0) {
        alerts.push(`${maintenanceDue.length} equipment item(s) due for maintenance`);
      }
      if (fleetStats.unknownEquipment > 0) {
        alerts.push(`${fleetStats.unknownEquipment} equipment item(s) have unknown status`);
      }

      return {
        totalEquipment: fleetStats.totalEquipment,
        activeEquipment: fleetStats.activeEquipment,
        movingEquipment,
        maintenanceEquipment: fleetStats.maintenanceEquipment,
        recentActivity,
        alerts,
      };
    } catch (error) {
      console.error('[EquipmentService] Failed to get dashboard summary:', error);
      throw error;
    }
  }

  async getMaintenanceDue(): Promise<IEquipment[]> {
    return this.equipmentRepository.findDueForMaintenance();
  }

  async getInactiveEquipment(inactiveSince: Timestamp): Promise<IEquipment[]> {
    return this.equipmentRepository.findInactiveEquipment(inactiveSince);
  }

  async checkEquipmentHealth(id: EquipmentId): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  }> {
    try {
      const equipment = await this.getEquipment(id);
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check equipment status
      if (equipment.status === 'maintenance') {
        issues.push('Equipment is currently in maintenance');
        recommendations.push('Complete maintenance tasks before returning to service');
      }

      if (equipment.status === 'unknown') {
        issues.push('Equipment status is unknown');
        recommendations.push('Inspect equipment and update status');
      }

      // Check last position update
      if (equipment.lastPosition) {
        const age = Date.now() - equipment.lastPosition.timestamp.getTime();
        const ageHours = age / (1000 * 60 * 60);

        if (ageHours > 24) {
          issues.push('No position update for more than 24 hours');
          recommendations.push('Check GPS device and connectivity');
        } else if (ageHours > 4) {
          issues.push('Position update is older than 4 hours');
          recommendations.push('Verify equipment is operational');
        }

        // Check position accuracy
        if (equipment.lastPosition.accuracy > 10) {
          issues.push('GPS accuracy is poor (>10m)');
          recommendations.push('Check GPS antenna and signal quality');
        }
      } else {
        issues.push('No position data available');
        recommendations.push('Install or activate GPS tracking device');
      }

      // Determine overall health status
      let status: 'healthy' | 'warning' | 'critical';
      if (issues.some(issue => issue.includes('critical') || issue.includes('No position data'))) {
        status = 'critical';
      } else if (issues.length > 0) {
        status = 'warning';
      } else {
        status = 'healthy';
      }

      return { status, issues, recommendations };
    } catch (error) {
      console.error(`[EquipmentService] Failed to check equipment health for ${id}:`, error);
      throw error;
    }
  }

  // Private helper methods
  private async validateEquipmentCreation(data: CreateEquipmentData): Promise<void> {
    // Check for duplicate equipment ID
    const existing = await this.equipmentRepository.findById(data.id);
    if (existing) {
      throw new Error(`Equipment with ID ${data.id} already exists`);
    }

    // Add any additional business rules here
    // e.g., naming conventions, type restrictions, etc.
  }

  private async calculateFleetTotalDistance(): Promise<number> {
    // Simplified implementation - in a real system this would be more sophisticated
    const recentPositions = await this.positionRepository.getLatestPositions(1000);
    // This is a placeholder - real implementation would calculate actual distances
    return recentPositions.length * 100; // Mock: 100m per position
  }

  private async calculateFleetOperatingTime(): Promise<number> {
    // Simplified implementation - in a real system this would track actual operating hours
    const activeCount = await this.equipmentRepository.countByStatus('active' as EquipmentStatus);
    const hoursPerDay = 8; // Assume 8 hours per day
    const daysPerMonth = 30;
    return activeCount * hoursPerDay * daysPerMonth * 3600; // Convert to seconds
  }
}

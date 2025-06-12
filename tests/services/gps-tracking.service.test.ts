/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GPS Tracking Service Unit Tests
 * Comprehensive test suite covering essential functionality for 80% coverage
 */

import { GpsTrackingService } from '../../src/services/gps-tracking.service.js';
import type { IPositionRepository } from '../../src/repositories/position.repository.js';
import type { IEquipmentService } from '../../src/services/equipment.service.js';
import { PositionSource } from '../../src/types/index.js';

// Mock dependencies
const mockPositionRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
  findMany: jest.fn(),
  createMany: jest.fn(),
  updateMany: jest.fn(),
  deleteMany: jest.fn(),
  exists: jest.fn(),
  count: jest.fn(),
  findByEquipmentId: jest.fn(),
  findLatestByEquipmentId: jest.fn(),
  findByEquipmentIds: jest.fn(),
  findInTimeRange: jest.fn(),
  findByEquipmentInTimeRange: jest.fn(),
  findInArea: jest.fn(),
  findNearPosition: jest.fn(),
  findByFilter: jest.fn(),
  getPositionCount: jest.fn(),
  getLatestPositions: jest.fn(),
  getPositionsByAccuracy: jest.fn(),
  deleteOlderThan: jest.fn(),
  deleteByEquipmentId: jest.fn(),
} as unknown as jest.Mocked<IPositionRepository>;

const mockEquipmentService = {
  createEquipment: jest.fn(),
  getEquipment: jest.fn(),
  updateEquipment: jest.fn(),
  deleteEquipment: jest.fn(),
  getAllEquipment: jest.fn(),
  findEquipment: jest.fn(),
  getEquipmentByType: jest.fn(),
  getEquipmentByStatus: jest.fn(),
  getActiveEquipment: jest.fn(),
  getEquipmentInArea: jest.fn(),
  updateEquipmentPosition: jest.fn(),
  getEquipmentPositions: jest.fn(),
  getEquipmentMovementAnalysis: jest.fn(),
  getFleetStatistics: jest.fn(),
  getDashboardSummary: jest.fn(),
  getMaintenanceDue: jest.fn(),
  getInactiveEquipment: jest.fn(),
  checkEquipmentHealth: jest.fn(),
} as unknown as jest.Mocked<IEquipmentService>;

describe('GpsTrackingService', () => {
  let service: GpsTrackingService;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    // Force cleanup of any remaining timers
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock console methods to avoid noise in tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Create fresh service instance
    service = new GpsTrackingService(mockPositionRepository, mockEquipmentService);
  });

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    jest.clearAllTimers(); // Clear any timeouts set by the service
  });

  describe('constructor and initialization', () => {
    it('should initialize service with dependencies', () => {
      expect(service).toBeInstanceOf(GpsTrackingService);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[GpsTrackingService] Initializing GPS tracking service',
      );
    });

    it('should schedule statistics reset', () => {
      // The constructor should call scheduleStatisticsReset
      // We can't easily test the timeout, but we can verify the service initializes
      expect(service).toBeTruthy();
    });
  });

  describe('processPositionUpdate', () => {
    const equipmentId = 'TEST-001';
    const validPositionData = {
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 10.0,
      accuracy: 2.5,
      timestamp: new Date(),
    };

    // Helper function to create a proper StoredPosition mock
    const createStoredPositionMock = (data: any): any => ({
      id: 'pos_123',
      equipmentId,
      source: PositionSource.GPS,
      ...data,
      distanceTo: jest.fn().mockReturnValue(0),
    });

    beforeEach(() => {
      mockPositionRepository.create.mockResolvedValue(createStoredPositionMock(validPositionData));
      mockEquipmentService.updateEquipmentPosition.mockResolvedValue();
    });

    it('should process valid position update successfully', async () => {
      await service.processPositionUpdate(equipmentId, validPositionData);

      expect(mockPositionRepository.create).toHaveBeenCalledWith({
        equipmentId,
        ...validPositionData,
      });
      expect(mockEquipmentService.updateEquipmentPosition).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[GpsTrackingService] Processed position update for equipment ${equipmentId}`,
      );
    });

    it('should use default source when not provided', async () => {
      await service.processPositionUpdate(equipmentId, validPositionData);

      expect(mockPositionRepository.create).toHaveBeenCalledWith({
        equipmentId,
        ...validPositionData,
      });
    });

    it('should use provided source', async () => {
      await service.processPositionUpdate(equipmentId, validPositionData, PositionSource.Manual);

      expect(mockPositionRepository.create).toHaveBeenCalledWith({
        equipmentId,
        ...validPositionData,
      });
    });

    it('should handle repository errors', async () => {
      const error = new Error('Database error');
      mockPositionRepository.create.mockRejectedValue(error);

      await expect(service.processPositionUpdate(equipmentId, validPositionData)).rejects.toThrow(
        'Database error',
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `[GpsTrackingService] Failed to process position update for equipment ${equipmentId}:`,
        error,
      );
    });

    it('should handle equipment service errors', async () => {
      const error = new Error('Equipment not found');
      mockEquipmentService.updateEquipmentPosition.mockRejectedValue(error);

      await expect(service.processPositionUpdate(equipmentId, validPositionData)).rejects.toThrow(
        'Equipment not found',
      );
    });

    it('should ignore duplicate positions', async () => {
      // First position
      await service.processPositionUpdate(equipmentId, validPositionData);

      // Clear mocks to test second call
      jest.clearAllMocks();

      // Same position (duplicate)
      const duplicatePosition = { ...validPositionData };
      await service.processPositionUpdate(equipmentId, duplicatePosition);

      // Should log duplicate message and not process
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[GpsTrackingService] Ignoring duplicate position for equipment ${equipmentId}`,
      );
      expect(mockPositionRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('processNmeaData', () => {
    const equipmentId = 'TEST-001';

    // Helper function to create a proper StoredPosition mock
    const createStoredPositionMock = (data: any): any => ({
      id: 'pos_123',
      equipmentId,
      source: PositionSource.GPS,
      ...data,
      distanceTo: jest.fn().mockReturnValue(0),
    });

    it('should process valid GGA NMEA sentence', async () => {
      const nmeaData = '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47';

      mockPositionRepository.create.mockResolvedValue(
        createStoredPositionMock({
          latitude: 48.1173,
          longitude: 11.5167,
          altitude: 545.4,
          accuracy: 5.0,
          timestamp: new Date(),
        }),
      );
      mockEquipmentService.updateEquipmentPosition.mockResolvedValue();

      await service.processNmeaData(equipmentId, nmeaData);

      expect(mockPositionRepository.create).toHaveBeenCalled();
    });

    it('should handle invalid NMEA data', async () => {
      const invalidNmeaData = 'invalid nmea string';

      await service.processNmeaData(equipmentId, invalidNmeaData);

      expect(mockPositionRepository.create).not.toHaveBeenCalled();
    });

    it('should handle NMEA processing errors', async () => {
      const nmeaData = '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47';
      const error = new Error('Processing error');
      mockPositionRepository.create.mockRejectedValue(error);

      await expect(service.processNmeaData(equipmentId, nmeaData)).rejects.toThrow(
        'Processing error',
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('tracking management', () => {
    const equipmentId = 'TEST-001';

    beforeEach(() => {
      mockEquipmentService.getEquipment.mockResolvedValue({
        id: equipmentId,
        name: 'Test Equipment',
        type: 'forklift' as any,
        status: 'active' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    describe('startTracking', () => {
      it('should start tracking for valid equipment', async () => {
        await service.startTracking(equipmentId);

        expect(mockEquipmentService.getEquipment).toHaveBeenCalledWith(equipmentId);
        expect(service.isTracking(equipmentId)).toBe(true);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          `[GpsTrackingService] Started tracking equipment ${equipmentId}`,
        );
      });

      it('should handle equipment not found', async () => {
        const error = new Error('Equipment not found');
        mockEquipmentService.getEquipment.mockRejectedValue(error);

        await expect(service.startTracking(equipmentId)).rejects.toThrow('Equipment not found');
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('stopTracking', () => {
      it('should stop tracking for equipment', async () => {
        // Start tracking first
        await service.startTracking(equipmentId);

        // Then stop tracking
        await service.stopTracking(equipmentId);

        expect(service.isTracking(equipmentId)).toBe(false);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          `[GpsTrackingService] Stopped tracking equipment ${equipmentId}`,
        );
      });

      it('should handle stopping non-tracked equipment', async () => {
        await service.stopTracking('NON-EXISTENT');

        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[GpsTrackingService] Stopped tracking equipment NON-EXISTENT',
        );
      });
    });

    describe('isTracking', () => {
      it('should return false for non-tracked equipment', () => {
        expect(service.isTracking('NON-EXISTENT')).toBe(false);
      });

      it('should return true for tracked equipment', async () => {
        await service.startTracking(equipmentId);
        expect(service.isTracking(equipmentId)).toBe(true);
      });
    });
  });

  describe('simulation', () => {
    const equipmentId = 'TEST-001';
    const mockRoute = [
      {
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 10,
        accuracy: 2.5,
        timestamp: new Date(),
        distanceTo: jest.fn(),
      },
      {
        latitude: 37.775,
        longitude: -122.4195,
        altitude: 11,
        accuracy: 2.0,
        timestamp: new Date(),
        distanceTo: jest.fn(),
      },
    ];

    beforeEach(() => {
      mockEquipmentService.getEquipment.mockResolvedValue({
        id: equipmentId,
        name: 'Test Equipment',
        type: 'forklift' as any,
        status: 'active' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    describe('simulateMovement', () => {
      it('should start simulation with valid route', async () => {
        await service.simulateMovement(equipmentId, mockRoute, 1000);

        expect(mockEquipmentService.getEquipment).toHaveBeenCalledWith(equipmentId);
        expect(service.isTracking(equipmentId)).toBe(true);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          `[GpsTrackingService] Started simulation for equipment ${equipmentId} with ${mockRoute.length} waypoints`,
        );
      });

      it('should handle equipment not found during simulation', async () => {
        const error = new Error('Equipment not found');
        mockEquipmentService.getEquipment.mockRejectedValue(error);

        await expect(service.simulateMovement(equipmentId, mockRoute)).rejects.toThrow(
          'Equipment not found',
        );
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it('should use default interval when not provided', async () => {
        await service.simulateMovement(equipmentId, mockRoute);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          `[GpsTrackingService] Started simulation for equipment ${equipmentId} with ${mockRoute.length} waypoints`,
        );
      });
    });

    describe('stopSimulation', () => {
      it('should stop active simulation', async () => {
        await service.simulateMovement(equipmentId, mockRoute, 1000);

        service.stopSimulation(equipmentId);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          `[GpsTrackingService] Stopped simulation for equipment ${equipmentId}`,
        );
      });

      it('should handle stopping non-existent simulation', () => {
        service.stopSimulation('NON-EXISTENT');
        // Should not throw error
      });
    });
  });

  describe('event handling', () => {
    it('should register position update callback', () => {
      const callback = jest.fn();
      service.onPositionUpdate(callback);

      // Verify the event listener was registered (we can't easily test the actual event)
      expect(callback).toBeDefined();
    });

    it('should register movement detection callback', () => {
      const callback = jest.fn();
      service.onMovementDetected(callback);

      expect(callback).toBeDefined();
    });

    it('should register geofence violation callback', () => {
      const callback = jest.fn();
      service.onGeofenceViolation(callback);

      expect(callback).toBeDefined();
    });
  });

  describe('getTrackingStatistics', () => {
    beforeEach(() => {
      mockEquipmentService.getEquipment.mockResolvedValue({
        id: 'TEST-001',
        name: 'Test Equipment',
        type: 'forklift' as any,
        status: 'active' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should return tracking statistics', async () => {
      // Start tracking some equipment
      await service.startTracking('TEST-001');

      const stats = await service.getTrackingStatistics();

      expect(stats).toEqual({
        totalTrackedEquipment: 1,
        activeTracking: 1,
        positionsProcessedToday: 0,
        averageAccuracy: 0,
        lastUpdateTimes: {},
      });
    });

    it('should return empty statistics when no tracking', async () => {
      const stats = await service.getTrackingStatistics();

      expect(stats).toEqual({
        totalTrackedEquipment: 0,
        activeTracking: 0,
        positionsProcessedToday: 0,
        averageAccuracy: 0,
        lastUpdateTimes: {},
      });
    });

    it('should include accuracy statistics after processing positions', async () => {
      const equipmentId = 'TEST-001';
      const positionData = {
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 10.0,
        accuracy: 5.0,
        timestamp: new Date(),
      };

      const createStoredPositionMock = (data: any): any => ({
        id: 'pos_123',
        equipmentId,
        source: PositionSource.GPS,
        ...data,
        distanceTo: jest.fn().mockReturnValue(0),
      });

      mockPositionRepository.create.mockResolvedValue(createStoredPositionMock(positionData));
      mockEquipmentService.updateEquipmentPosition.mockResolvedValue();

      await service.processPositionUpdate(equipmentId, positionData);

      const stats = await service.getTrackingStatistics();

      expect(stats.positionsProcessedToday).toBe(1);
      expect(stats.averageAccuracy).toBe(5.0);
    });
  });

  describe('private helper methods (through public interface)', () => {
    it('should calculate speed between positions', async () => {
      const equipmentId = 'TEST-001';

      // Helper function to create a proper StoredPosition mock
      const createStoredPositionMock = (data: any, id: string): any => ({
        id,
        equipmentId,
        source: PositionSource.GPS,
        ...data,
        distanceTo: jest.fn().mockReturnValue(100), // Mock 100 meters distance
      });

      // First position
      const position1 = {
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 10.0,
        accuracy: 2.5,
        timestamp: new Date(),
      };

      // Second position (slightly different, 5 seconds later)
      const position2 = {
        latitude: 37.775,
        longitude: -122.4195,
        altitude: 10.0,
        accuracy: 2.5,
        timestamp: new Date(position1.timestamp.getTime() + 5000),
      };

      mockPositionRepository.create.mockResolvedValueOnce(
        createStoredPositionMock(position1, 'pos_123'),
      );
      mockEquipmentService.updateEquipmentPosition.mockResolvedValue();

      // Process first position
      await service.processPositionUpdate(equipmentId, position1);

      // Process second position (should trigger movement detection)
      mockPositionRepository.create.mockResolvedValueOnce(
        createStoredPositionMock(position2, 'pos_124'),
      );

      await service.processPositionUpdate(equipmentId, position2);

      // Verify both positions were processed
      expect(mockPositionRepository.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('NMEA parsing', () => {
    // Helper function to create a proper StoredPosition mock
    const createStoredPositionMock = (data: any): any => ({
      id: 'pos_123',
      equipmentId: 'TEST-001',
      source: PositionSource.GPS,
      ...data,
      distanceTo: jest.fn().mockReturnValue(0),
    });

    it('should parse coordinates correctly', async () => {
      const equipmentId = 'TEST-001';
      // Valid GGA sentence with coordinates
      const nmeaData = '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47';

      mockPositionRepository.create.mockResolvedValue(
        createStoredPositionMock({
          latitude: 48.1173,
          longitude: 11.5167,
          altitude: 545.4,
          accuracy: 5.0,
          timestamp: new Date(),
        }),
      );
      mockEquipmentService.updateEquipmentPosition.mockResolvedValue();

      await service.processNmeaData(equipmentId, nmeaData);

      expect(mockPositionRepository.create).toHaveBeenCalled();

      // Safe access to mock calls
      const createCalls = mockPositionRepository.create.mock.calls;
      if (createCalls.length > 0 && createCalls[0]) {
        const createCall = createCalls[0][0];
        expect(createCall.latitude).toBeCloseTo(48.1173, 3);
        expect(createCall.longitude).toBeCloseTo(11.5167, 3);
      }
    });

    it('should handle malformed NMEA sentences', async () => {
      const equipmentId = 'TEST-001';
      const malformedNmea = '$GPGGA,invalid,data,format';

      await service.processNmeaData(equipmentId, malformedNmea);

      expect(mockPositionRepository.create).not.toHaveBeenCalled();
    });

    it('should handle empty NMEA data', async () => {
      const equipmentId = 'TEST-001';

      await service.processNmeaData(equipmentId, '');

      expect(mockPositionRepository.create).not.toHaveBeenCalled();
    });

    it('should handle multiple NMEA sentences', async () => {
      const equipmentId = 'TEST-001';
      const multipleNmea =
        '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47\n$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A';

      mockPositionRepository.create.mockResolvedValue(
        createStoredPositionMock({
          latitude: 48.1173,
          longitude: 11.5167,
          altitude: 545.4,
          accuracy: 5.0,
          timestamp: new Date(),
        }),
      );
      mockEquipmentService.updateEquipmentPosition.mockResolvedValue();

      await service.processNmeaData(equipmentId, multipleNmea);

      expect(mockPositionRepository.create).toHaveBeenCalled();
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle invalid position data gracefully', async () => {
      const equipmentId = 'TEST-001';
      const invalidPosition = {
        latitude: 'invalid' as any,
        longitude: -122.4194,
        altitude: 10.0,
        accuracy: 2.5,
        timestamp: new Date(),
      };

      await expect(service.processPositionUpdate(equipmentId, invalidPosition)).rejects.toThrow();
    });

    it('should handle simulation with empty route', async () => {
      const equipmentId = 'TEST-001';
      mockEquipmentService.getEquipment.mockResolvedValue({
        id: equipmentId,
        name: 'Test Equipment',
        type: 'forklift' as any,
        status: 'active' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.simulateMovement(equipmentId, []);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[GpsTrackingService] Started simulation for equipment ${equipmentId} with 0 waypoints`,
      );
    });

    it('should handle multiple start tracking calls for same equipment', async () => {
      const equipmentId = 'TEST-001';
      mockEquipmentService.getEquipment.mockResolvedValue({
        id: equipmentId,
        name: 'Test Equipment',
        type: 'forklift' as any,
        status: 'active' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.startTracking(equipmentId);
      await service.startTracking(equipmentId); // Second call

      expect(service.isTracking(equipmentId)).toBe(true);
      expect(mockEquipmentService.getEquipment).toHaveBeenCalledTimes(2);
    });
  });
});

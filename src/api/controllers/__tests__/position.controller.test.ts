// <test_code>
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PositionController } from '../../src/api/controllers/position.controller.js';
import { createError } from '../../src/api/middleware/error.middleware.js';
import { logger } from '../../src/api/middleware/logging.middleware.js';
import { sanitizePositionQuery, parseGeographicBounds } from '../../src/infrastructure/utils/query-parser.js';

// Mock dependencies
jest.mock('../../src/api/middleware/logging.middleware.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../src/api/middleware/error.middleware.js', () => ({
  createError: {
    badRequest: jest.fn((message) => new Error(message)),
  },
}));

jest.mock('../../src/infrastructure/utils/query-parser.js', () => ({
  sanitizePositionQuery: jest.fn(),
  parseGeographicBounds: jest.fn(),
}));

describe('PositionController', () => {
  let positionController;
  let mockPositionRepository;
  let mockGpsTrackingService;
  let mockAppService;
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    // Create mock repositories and services
    mockPositionRepository = {
      findByFilter: jest.fn(),
      getLatestPositions: jest.fn(),
      findByEquipmentIds: jest.fn(),
      findInArea: jest.fn(),
      getPositionsByAccuracy: jest.fn(),
      getPositionCount: jest.fn(),
      deleteOlderThan: jest.fn(),
      findByEquipmentInTimeRange: jest.fn(),
      findNearPosition: jest.fn(),
    };

    mockGpsTrackingService = {
      getTrackingStatistics: jest.fn(),
    };

    mockAppService = {
      processPositionUpdate: jest.fn(),
    };

    // Create controller instance
    positionController = new PositionController(
      mockPositionRepository,
      mockGpsTrackingService,
      mockAppService
    );

    // Setup mock request, response, and next function
    mockRequest = {
      query: {},
      body: {},
      user: { id: 'test-user-id' },
    };

    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('convertToPositionWithMetadata', () => {
    it('should convert position data to the expected format', () => {
      const positions = [
        {
          id: '1',
          equipmentId: 'equip-1',
          latitude: 40.7128,
          longitude: -74.006,
          altitude: 10,
          accuracy: 5,
          timestamp: new Date(),
          source: 'gps',
          speed: 20,
          heading: 90,
          satellites: 8,
          distanceTo: 100,
          extraField: 'should-be-removed',
        },
      ];

      const result = positionController.convertToPositionWithMetadata(positions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '1',
        equipmentId: 'equip-1',
        latitude: 40.7128,
        longitude: -74.006,
        altitude: 10,
        accuracy: 5,
        timestamp: positions[0].timestamp,
        source: 'gps',
        speed: 20,
        heading: 90,
        satellites: 8,
        distanceTo: 100,
      });
      expect(result[0].extraField).toBeUndefined();
    });

    it('should handle empty array', () => {
      const result = positionController.convertToPositionWithMetadata([]);
      expect(result).toEqual([]);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      sanitizePositionQuery.mockReturnValue({
        filter: { equipmentId: 'equip-1' },
        pagination: { page: 1, limit: 10 },
      });
    });

    it('should return positions with pagination', async () => {
      const mockPositions = [
        {
          id: '1',
          equipmentId: 'equip-1',
          latitude: 40.7128,
          longitude: -74.006,
          timestamp: new Date(),
        },
      ];

      mockPositionRepository.findByFilter.mockResolvedValue({
        data: mockPositions,
        pagination: { page: 1, limit: 10, total: 1 },
      });

      await positionController.list(mockRequest, mockResponse, mockNext);

      expect(sanitizePositionQuery).toHaveBeenCalledWith(mockRequest.query);
      expect(mockPositionRepository.findByFilter).toHaveBeenCalledWith(
        { equipmentId: 'equip-1' },
        { page: 1, limit: 10 }
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          data: expect.arrayContaining([
            expect.objectContaining({
              id: '1',
              equipmentId: 'equip-1',
            }),
          ]),
          pagination: { page: 1, limit: 10, total: 1 },
          success: true,
          timestamp: expect.any(Date),
        },
        timestamp: expect.any(Date),
      });
    });

    it('should handle errors and pass to next middleware', async () => {
      const error = new Error('Database error');
      mockPositionRepository.findByFilter.mockRejectedValue(error);

      await positionController.list(mockRequest, mockResponse, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to list positions',
        expect.objectContaining({
          error: 'Database error',
          userId: 'test-user-id',
        })
      );
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getLatest', () => {
    it('should return latest positions with default limit', async () => {
      const mockPositions = [
        {
          id: '1',
          equipmentId: 'equip-1',
          latitude: 40.7128,
          longitude: -74.006,
          timestamp: new Date(),
        },
      ];

      mockPositionRepository.getLatestPositions.mockResolvedValue(mockPositions);

      await positionController.getLatest(mockRequest, mockResponse, mockNext);

      expect(mockPositionRepository.getLatestPositions).toHaveBeenCalledWith(50);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            equipmentId: 'equip-1',
          }),
        ]),
        timestamp: expect.any(Date),
        meta: {
          limit: 50,
          totalReturned: 1,
        },
      });
    });

    it('should use custom limit when provided', async () => {
      mockRequest.query.limit = '20';
      mockPositionRepository.getLatestPositions.mockResolvedValue([]);

      await positionController.getLatest(mockRequest, mockResponse, mockNext);

      expect(mockPositionRepository.getLatestPositions).toHaveBeenCalledWith(20);
    });

    it('should return error when limit exceeds maximum', async () => {
      mockRequest.query.limit = '1500';

      await positionController.getLatest(mockRequest, mockResponse, mockNext);

      expect(createError.badRequest).toHaveBeenCalledWith('Limit cannot exceed 1000');
      expect(mockNext).toHaveBeenCalled();
      expect(mockPositionRepository.getLatestPositions).not.toHaveBeenCalled();
    });

    it('should handle errors and pass to next middleware', async () => {
      const error = new Error('Database error');
      mockPositionRepository.getLatestPositions.mockRejectedValue(error);

      await positionController.getLatest(mockRequest, mockResponse, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get latest positions',
        expect.objectContaining({
          error: 'Database error',
          userId: 'test-user-id',
        })
      );
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getLive', () => {
    it('should return latest positions when no filters provided', async () => {
      const mockPositions = [
        {
          id: '1',
          equipmentId: 'equip-1',
          latitude: 40.7128,
          longitude: -74.006,
          timestamp: new Date(),
        },
      ];

      mockPositionRepository.getLatestPositions.mockResolvedValue(mockPositions);

      await positionController.getLive(mockRequest, mockResponse, mockNext);

      expect(mockPositionRepository.getLatestPositions).toHaveBeenCalledWith(100);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            equipmentId: 'equip-1',
          }),
        ]),
        timestamp: expect.any(Date),
      });
    });

    it('should filter by equipment IDs when provided', async () => {
      mockRequest.query.equipmentIds = 'equip-1,equip-2';
      
      mockPositionRepository.findByEquipmentIds.mockResolvedValue({
        data: [{ id: '1', equipmentId: 'equip-1', latitude: 40.7128, longitude: -74.006 }],
      });

      await positionController.getLive(mockRequest, mockResponse, mockNext);

      expect(mockPositionRepository.findByEquipmentIds).toHaveBeenCalledWith(
        ['equip-1', 'equip-2'],
        { page: 1, limit: 100 }
      );
      expect(mockPositionRepository.getLatestPositions).not.toHaveBeenCalled();
    });

    it('should filter by geographic bounds when provided', async () => {
      mockRequest.query.bounds = '{"southWest":{"lat":40,"lng":-75},"northEast":{"lat":41,"lng":-74}}';
      const mockBounds = {
        southWest: { lat: 40, lng: -75 },
        northEast: { lat: 41, lng: -74 },
      };
      
      parseGeographicBounds.mockReturnValue(mockBounds);
      mockPositionRepository.findInArea.mockResolvedValue({
        data: [{ id: '1', equipmentId: 'equip-1', latitude: 40.5, longitude: -74.5 }],
      });

      await positionController.getLive(mockRequest, mockResponse, mockNext);

      expect(parseGeographicBounds).toHaveBeenCalledWith(mockRequest.query.bounds);
      expect(mockPositionRepository.findInArea).toHaveBeenCalledWith(
        mockBounds,
        { page: 1, limit: 100 }
      );
    });

    it('should handle errors and pass to next middleware', async () => {
      const error = new Error('Database error');
      mockPositionRepository.getLatestPositions.mockRejectedValue(error);

      await positionController.getLive(mockRequest, mockResponse, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get live positions',
        expect.objectContaining({
          error: 'Database error',
          userId: 'test-user-id',
        })
      );
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('bulkCreate', () => {
    beforeEach(() => {
      mockRequest.body = {
        positions: [
          {
            equipmentId: 'equip-1',
            latitude: 40.7128,
            longitude: -74.006,
            altitude: 10,
            accuracy: 5,
            timestamp: new Date(),
          },
          {
            equipmentId: 'equip-2',
            latitude: 34.0522,
            longitude: -118.2437,
          },
        ],
      };
    });

    it('should process multiple position updates successfully', async () => {
      mockAppService.processPositionUpdate.mockResolvedValue(undefined);

      await positionController.bulkCreate(mockRequest, mockResponse, mockNext);

      expect(mockAppService.processPositionUpdate).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { created: 2, errors: [] },
        timestamp: expect.any(Date),
      });
    });

    it('should handle partial failures and report errors', async () => {
      mockAppService.processPositionUpdate
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Invalid position data'));

      await positionController.bulkCreate(mockRequest, mockResponse, mockNext);

      expect(mockAppService.processPositionUpdate).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          created: 1,
          errors: ['Failed to create position for equipment equip-2: Invalid position data'],
        },
        timestamp: expect.any(Date),
      });
    });

    it('should return 400 status when all positions fail', async () => {
      mockAppService.processPositionUpdate.mockRejectedValue(new Error('Invalid position data'));

      await positionController.bulkCreate(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        data: {
          created: 0,
          errors: [
            'Failed to create position for equipment equip-1: Invalid position data',
            'Failed to create position for equipment equip-2: Invalid position data',
          ],
        },
        timestamp: expect.any(Date),
      });
    });

    it('should handle errors and pass to next middleware', async () => {
      const error = new Error('Unexpected error');
      mockRequest.body = {}; // Invalid request body
      
      await positionController.bulkCreate(mockRequest, mockResponse, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to bulk create positions',
        expect.objectContaining({
          userId: 'test-user-id',
          positionCount: 0,
        })
      );
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getInArea', () => {
    beforeEach(() => {
      mockRequest.query = {
        minLat: '40',
        maxLat: '41',
        minLng: '-75',
        maxLng: '-74',
        page: '1',
        limit: '20',
      };
    });

    it('should return positions within the specified area', async () => {
      const mockPositions = [
        {
          id: '1',
          equipmentId: 'equip-1',
          latitude: 40.5,
          longitude: -74.5,
          timestamp: new Date(),
        },
      ];

      mockPositionRepository.findInArea.mockResolvedValue({
        data: mockPositions,
        pagination: { page: 1, limit: 20, total: 1 },
      });

      await positionController.getInArea(mockRequest, mockResponse, mockNext);

      expect(mockPositionRepository.findInArea).toHaveBeenCalledWith(
        {
          southWest: { lat: 40, lng: -75 },
          northEast: { lat: 41, lng: -74 },
        },
        { page: 1, limit: 20 }
      );
      
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            equipmentId: 'equip-1',
          }),
        ]),
        timestamp: expect.any(Date),
        pagination: { page: 1, limit: 20, total: 1 },
        meta: {
          searchArea: {
            southWest: { lat: 40, lng: -75 },
            northEast: { lat: 41, lng: -74 },
          },
          equipmentFound: 1,
        },
      });
    });

    it('should return error when required parameters are missing', async () => {
      mockRequest.query = { minLat: '40', maxLat: '41' }; // Missing minLng and maxLng

      await positionController.getInArea(mockRequest, mockResponse, mockNext);

      expect(createError.badRequest).toHaveBeenCalledWith(
        'Missing required parameters: minLat, maxLat, minLng, maxLng'
      );
      expect(mockNext).toHaveBeenCalled();
      expect(mockPositionRepository.findInArea).not.toHaveBeenCalled();
    });

    it('should return error when bounds are invalid', async () => {
      mockRequest.query = {
        minLat: '41', // minLat > maxLat (invalid)
        maxLat: '40',
        minLng: '-75',
        maxLng: '-74',
      };

      await positionController.getInArea(mockRequest, mockResponse, mockNext);

      expect(createError.badRequest).toHaveBeenCalledWith('Invalid geographic bounds');
      expect(mockNext).toHaveBeenCalled();
      expect(mockPositionRepository.findInArea).not.toHaveBeenCalled();
    });

    it('should handle errors and pass to next middleware', async () => {
      const error = new Error('Database error');
      mockPositionRepository.findInArea.mockRejectedValue(error);

      await positionController.getInArea(mockRequest, mockResponse, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get positions in area',
        expect.objectContaining({
          error: 'Database error',
          userId: 'test-user-id',
        })
      );
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getNear', () => {
    beforeEach(() => {
      mockRequest.query = {
        lat: '40.7128',
        lng: '-74.006',
        radius: '1000',
        page: '1',
        limit: '20',
      };
    });

    it('should return positions near the specified point', async () => {
      const mockPositions = [
        {
          id: '1',
          equipmentId: 'equip-1',
          latitude: 40.7,
          longitude: -74.0,
          timestamp: new Date(),
        },
      ];

      mockPositionRepository.findNearPosition.mockResolvedValue({
        data: mockPositions,
        pagination: { page: 1, limit: 20, total: 1 },
      });

      await positionController.getNear(mockRequest, mockResponse, mockNext);

      expect(mockPositionRepository.findNearPosition).toHaveBeenCalledWith(
        40.7128,
        -74.006,
        1000,
        { page: 1, limit: 20 }
      );
      
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            equipmentId: 'equip-1',
          }),
        ]),
        timestamp: expect.any(Date),
        pagination: { page: 1, limit: 20, total: 1 },
        meta: {
          searchCenter: { latitude: 40.7128, longitude: -74.006 },
          searchRadius: 1000,
          equipmentFound: 1,
        },
      });
    });

    it('should return error when required parameters are missing', async () => {
      mockRequest.query = { lat: '40.7128', lng: '-74.006' }; // Missing radius

      await positionController.getNear(mockRequest, mockResponse, mockNext);

      expect(createError.badRequest).toHaveBeenCalledWith(
        'Missing required parameters: lat, lng, radius'
      );
      expect(mockNext).toHaveBeenCalled();
      expect(mockPositionRepository.findNearPosition).not.toHaveBeenCalled();
    });

    it('should return error when radius exceeds maximum', async () => {
      mockRequest.query.radius = '60000'; // Exceeds 50km limit

      await positionController.getNear(mockRequest, mockResponse, mockNext);

      expect(createError.badRequest).toHaveBeenCalledWith('Radius cannot exceed 50km');
      expect(mockNext).toHaveBeenCalled();
      expect(mockPositionRepository.findNearPosition).not.toHaveBeenCalled();
    });

    it('should handle errors and pass to next middleware', async () => {
      const error = new Error('Database error');
      mockPositionRepository.findNearPosition.mockRejectedValue(error);

      await positionController.getNear(mockRequest, mockResponse, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get positions near point',
        expect.objectContaining({
          error: 'Database error',
          userId: 'test-user-id',
        })
      );
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getByAccuracy', () => {
    it('should return positions filtered by accuracy range', async () => {
      mockRequest.query = { min: '5', max: '20' };
      
      const mockPositions = [
        {
          id: '1',
          equipmentId: 'equip-1',
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 10,
          timestamp: new Date(),
        },
      ];

      mockPositionRepository.getPositionsByAccuracy.mockResolvedValue(mockPositions);

      await positionController.getByAccuracy(mockRequest, mockResponse, mockNext);

      expect(mockPositionRepository.getPositionsByAccuracy).toHaveBeenCalledWith(5, 20);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            equipmentId: 'equip-1',
            accuracy: 10,
          }),
        ]),
        timestamp: expect.any(Date),
        meta: {
          accuracyFilter: { min: 5, max: 20 },
          averageAccuracy: 10,
        },
      });
    });

    it('should handle min accuracy only', async () => {
      mockRequest.query = { min: '5' };
      mockPositionRepository.getPositionsByAccuracy.mockResolvedValue([]);

      await positionController.getByAccuracy(mockRequest, mockResponse, mockNext);

      expect(mockPositionRepository.getPositionsByAccuracy).toHaveBeenCalledWith(5, undefined);
    });

    it('should handle max accuracy only', async () => {
      mockRequest.query = { max: '20' };
      mockPositionRepository.getPositionsByAccuracy.mockResolvedValue([]);

      await positionController.getByAccuracy(mockRequest, mockResponse, mockNext);

      expect(mockPositionRepository.getPositionsByAccuracy).toHaveBeenCalledWith(undefined, 20);
    });

    it('should return error when min accuracy is invalid', async () => {
      mockRequest.query = { min: '1500' }; // Exceeds 1000m limit

      await positionController.getByAccuracy(mockRequest, mockResponse, mockNext);

      expect(createError.badRequest).toHaveBeenCalledWith('Min accuracy must be between 0 and 1000 meters');
      expect(mockNext).toHaveBeenCalled();
      expect(mockPositionRepository.getPositionsByAccuracy).not.toHaveBeenCalled();
    });

    it('should return error when max accuracy is invalid', async () => {
      mockRequest.query = { max: '-10' }; // Negative value

      await positionController.getByAccuracy(mockRequest, mockResponse, mockNext);

      expect(createError.badRequest).toHaveBeenCalledWith('Max accuracy must be between 0 and 1000 meters');
      expect(mockNext).toHaveBeenCalled();
      expect(mockPositionRepository.getPositionsByAccuracy).not.toHaveBeenCalled();
    });

    it('should return error when min > max', async () => {
      mockRequest.query = { min: '30', max: '20' };

      await positionController.getByAccuracy(mockRequest, mockResponse, mockNext);

      expect(createError.badRequest).toHaveBeenCalledWith('Min accuracy cannot be greater than max accuracy');
      expect(mockNext).toHaveBeenCalled();
      expect(mockPositionRepository.getPositionsByAccuracy).not.toHaveBeenCalled();
    });

    it('should handle errors and pass to next middleware', async () => {
      mockRequest.query = { min: '5', max: '20' };
      const error = new Error('Database error');
      mockPositionRepository.getPositionsByAccuracy.mockRejectedValue(error);

      await positionController.getByAccuracy(mockRequest, mockResponse, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get positions by accuracy',
        expect.objectContaining({
          error: 'Database error',
          userId: 'test-user-id',
        })
      );
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getStats', () => {
    it('should return position statistics for all equipment', async () => {
      mockPositionRepository.getPositionCount.mockResolvedValue(100);
      mockGpsTrackingService.getTrackingStatistics.mockResolvedValue({
        totalTrackedEquipment: 10,
        activeEquipment: 5,
        averagePositionsPerDay: 50,
      });

      await positionController.getStats(mockRequest, mockResponse, mockNext);

      expect(mockPositionRepository.getPositionCount).toHaveBeenCalledWith(undefined);
      expect(mockGpsTrackingService.getTrackingStatistics).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          totalPositions: 100,
          totalTrackedEquipment: 10,
          activeEquipment: 5,
          averagePositionsPerDay: 50,
          statsFor: 'all equipment',
        },
        timestamp: expect.any(Date),
      });
    });

    it('should return position statistics for specific equipment', async () => {
      mockRequest.query.equipmentId = 'equip-1';
      mockPositionRepository.getPositionCount.mockResolvedValue(50);
      mockGpsTrackingService.getTrackingStatistics.mockResolvedValue({
        totalTrackedEquipment: 10,
        activeEquipment: 5,
        averagePositionsPerDay: 50,
      });

      await positionController.getStats(mockRequest, mockResponse, mockNext);

      expect(mockPositionRepository.getPositionCount).toHaveBeenCalledWith('equip-1');
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalPositions: 50,
            statsFor: 'equip-1',
          }),
        })
      );
    });

    it('should handle errors and pass to next middleware', async () => {
      const error = new Error('Database error');
      mockPositionRepository.getPositionCount.mockRejectedValue(error);

      await positionController.getStats(mockRequest, mockResponse, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get position statistics',
        expect.objectContaining({
          error: 'Database error',
          userId: 'test-user-id',
        })
      );
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('cleanup', () => {
    it('should delete old positions with default days', async () => {
      mockPositionRepository.deleteOlderThan.mockResolvedValue(50);

      await positionController.cleanup(mockRequest, mockResponse, mockNext);

      // Check that the cutoff date is approximately 30 days ago (default)
      expect(mockPositionRepository.deleteOlderThan).toHaveBeenCalledWith(expect.any(Date));
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          deletedCount: 50,
          cutoffDate: expect.any(Date),
          daysOld: 30,
        },
        timestamp: expect.any(Date),
      });
    });

    it('should use custom days parameter when provided', async () => {
      mockRequest.query.days = '60';
      mockPositionRepository.deleteOlderThan.mockResolvedValue(100);

      await positionController.cleanup(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deletedCount: 100,
            daysOld: 60,
          }),
        })
      );
    });

    it('should return error when days parameter is invalid', async () => {
      mockRequest.query.days = '500'; // Exceeds 365 days limit

      await positionController.cleanup(mockRequest, mockResponse, mockNext);

      expect(createError.badRequest).toHaveBeenCalledWith('Days must be between 1 and 365');
      expect(mockNext).toHaveBeenCalled();
      expect(mockPositionRepository.deleteOlderThan).not.toHaveBeenCalled();
    });

    it('should handle errors and pass to next middleware', async () => {
      const error = new Error('Database error');
      mockPositionRepository.deleteOlderThan.mockRejectedValue(error);

      await positionController.cleanup(mockRequest, mockResponse, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to cleanup positions',
        expect.objectContaining({
          error: 'Database error',
          userId: 'test-user-id',
        })
      );
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('analyzePatterns', () => {
    beforeEach(() => {
      mockRequest.body = {
        equipmentIds: ['equip-1', 'equip-2'],
        timeRange: {
          start: '2023-01-01T00:00:00Z',
          end: '2023-01-02T00:00:00Z',
        },
        analysisType: 'basic',
      };

      // Mock position data for analysis
      const mockPositions1 = {
        data: [
          {
            id: '1',
            equipmentId: 'equip-1',
            latitude: 40.7128,
            longitude: -74.006,
            timestamp: new Date('2023-01-01T01:00:00Z'),
          },
          {
            id: '2',
            equipmentId: 'equip-1',
            latitude: 40.7130,
            longitude: -74.008,
            timestamp: new Date('2023-01-01T02:00:00Z'),
          },
        ],
      };

      const mockPositions2 = {
        data: [],
      };

      mockPositionRepository.findByEquipmentInTimeRange
        .mockResolvedValueOnce(mockPositions1)
        .mockResolvedValueOnce(mockPositions2);
    });

    it('should analyze position patterns for multiple equipment', async () => {
      await positionController.analyzePatterns(mockRequest, mockResponse, mockNext);

      expect(mockPositionRepository.findByEquipmentInTimeRange).toHaveBeenCalledTimes(2);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          analysis: expect.arrayContaining([
            expect.objectContaining({
              equipmentId: 'equip-1',
              positionCount: 2,
              isActive: expect.any(Boolean),
            }),
            expect.objectContaining({
              equipmentId: 'equip-2',
              positionCount: 0,
              isActive: false,
            }),
          ]),
          summary: expect.objectContaining({
            totalEquipment: 2,
            activeEquipment: expect.any(Number),
            totalDistance: expect.any(Number),
          }),
        },
        timestamp: expect.any(Date),
        meta: {
          analysisType: 'basic',
          timeRange: {
            start: expect.any(Date),
            end: expect.any(Date),
          },
          requestedEquipment: 2,
        },
      });
    });

    it('should return error when equipment IDs are missing', async () => {
      mockRequest.body = { timeRange: { start: '2023-01-01', end: '2023-01-02' } };

      await positionController.analyzePatterns(mockRequest, mockResponse, mockNext);

      expect(createError.badRequest).toHaveBeenCalledWith('Equipment IDs are required');
      expect(mockNext).toHaveBeenCalled();
      expect(mockPositionRepository.findByEquipmentInTimeRange).not.toHaveBeenCalled();
    });

    it('should return error when too many equipment IDs are provided', async () => {
      mockRequest.body.equipmentIds = Array(51).fill().map((_, i) => `equip-${i}`);

      await positionController.analyzePatterns(mockRequest, mockResponse, mockNext);

      expect(createError.badRequest).toHaveBeenCalledWith('Cannot analyze more than 50 equipment items at once');
      expect(mockNext).toHaveBeenCalled();
      expect(mockPositionRepository.findByEquipmentInTimeRange).not.toHaveBeenCalled();
    });

    it('should use default time range when not provided', async () => {
      mockRequest.body = { equipmentIds: ['equip-1'] };

      await positionController.analyzePatterns(mockRequest, mockResponse, mockNext);

      expect(mockPositionRepository.findByEquipmentInTimeRange).toHaveBeenCalledWith(
        'equip-1',
        { start: expect.any(Date), end: expect.any(Date) },
        { page: 1, limit: 1000 }
      );
    });

    it('should handle errors for individual equipment and continue processing', async () => {
      mockPositionRepository.findByEquipmentInTimeRange
        .mockResolvedValueOnce({ data: [{ id: '1', equipmentId: 'equip-1', latitude: 40, longitude: -74, timestamp: new Date() }] })
        .mockRejectedValueOnce(new Error('Database error for equip-2'));

      await positionController.analyzePatterns(mockRequest, mockResponse, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to analyze equipment',
        expect.objectContaining({
          equipmentId: 'equip-2',
          error: 'Database error for equip-2',
        })
      );
      
      // Should still return results for equip-1
      expect(mockResponse.json).toHaveBeenCalled();
      expect(mockResponse.json.mock.calls[0][0].data.analysis).toHaveLength(1);
    });

    it('should handle general errors and pass to next middleware', async () => {
      const error = new Error('Unexpected error');
      mockPositionRepository.findByEquipmentInTimeRange.mockRejectedValue(error);

      await positionController.analyzePatterns(mockRequest, mockResponse, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to analyze position patterns',
        expect.objectContaining({
          error: 'Unexpected error',
          userId: 'test-user-id',
        })
      );
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
// </test_code>
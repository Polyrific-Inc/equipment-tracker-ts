// <test_code>
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EquipmentController } from '../../src/api/controllers/equipment.controller';
import { createError } from '../../src/api/middleware/error.middleware';
import { logger } from '../../src/api/middleware/logging.middleware';
import { NextFunction, Request, Response } from 'express';
import { BasePosition } from '@/types/position.types.js';

// Mock dependencies
jest.mock('../../src/api/middleware/logging.middleware', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../src/api/middleware/error.middleware', () => ({
  createError: {
    notFound: jest.fn().mockReturnValue(new Error('Not found')),
    badRequest: jest.fn().mockReturnValue(new Error('Bad request')),
    conflict: jest.fn().mockReturnValue(new Error('Conflict')),
  },
}));

jest.mock('../../src/infrastructure/utils/query-parser', () => ({
  sanitizeEquipmentQuery: jest.fn().mockReturnValue({
    filter: {},
    pagination: { page: 1, limit: 10 },
  }),
  sanitizePositionQuery: jest.fn().mockReturnValue({
    filter: {},
    pagination: { page: 1, limit: 10 },
  }),
  parseTimeRangeQuery: jest.fn().mockReturnValue({
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-01-31'),
  }),
}));

describe('EquipmentController', () => {
  let controller: EquipmentController;
  let mockEquipmentService: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock service
    mockEquipmentService = {
      findEquipment: jest.fn(),
      getEquipment: jest.fn(),
      createEquipment: jest.fn(),
      updateEquipment: jest.fn(),
      deleteEquipment: jest.fn(),
      getActiveEquipment: jest.fn(),
      getMaintenanceDue: jest.fn(),
      getInactiveEquipment: jest.fn(),
      checkEquipmentHealth: jest.fn(),
      getEquipmentPositions: jest.fn(),
      updateEquipmentPosition: jest.fn(),
      getEquipmentMovementAnalysis: jest.fn(),
      getAllEquipment: jest.fn(),
    };

    // Create controller with mock service
    controller = new EquipmentController(mockEquipmentService);

    // Create mock request, response, and next function
    mockRequest = {
      params: {},
      query: {},
      body: {},
      user: { id: 'user123' },
    };

    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('list', () => {
    it('should return a list of equipment', async () => {
      // Arrange
      const mockResult = {
        data: [{ id: 'equip1', name: 'Equipment 1' }],
        pagination: { page: 1, limit: 10, total: 1 },
      };
      mockEquipmentService.findEquipment.mockResolvedValue(mockResult);

      // Act
      await controller.list(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockEquipmentService.findEquipment).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Equipment list retrieved',
        expect.any(Object)
      );
    });

    it('should handle errors', async () => {
      // Arrange
      const error = new Error('Database error');
      mockEquipmentService.findEquipment.mockRejectedValue(error);

      // Act
      await controller.list(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to list equipment',
        expect.any(Object)
      );
    });
  });

  describe('getById', () => {
    it('should return equipment by ID', async () => {
      // Arrange
      const mockEquipment = { id: 'equip1', name: 'Equipment 1' };
      mockRequest.params = { id: 'equip1' };
      mockEquipmentService.getEquipment.mockResolvedValue(mockEquipment);

      // Act
      await controller.getById(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockEquipmentService.getEquipment).toHaveBeenCalledWith('equip1');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockEquipment,
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Equipment retrieved',
        expect.any(Object)
      );
    });

    it('should handle not found error', async () => {
      // Arrange
      mockRequest.params = { id: 'nonexistent' };
      const error = new Error('Equipment not found');
      mockEquipmentService.getEquipment.mockRejectedValue(error);

      // Act
      await controller.getById(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(createError.notFound).toHaveBeenCalledWith('Equipment');
      expect(logger.warn).toHaveBeenCalledWith(
        'Equipment not found',
        expect.any(Object)
      );
    });

    it('should handle general errors', async () => {
      // Arrange
      mockRequest.params = { id: 'equip1' };
      const error = new Error('Database error');
      mockEquipmentService.getEquipment.mockRejectedValue(error);

      // Act
      await controller.getById(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get equipment',
        expect.any(Object)
      );
    });
  });

  describe('create', () => {
    it('should create new equipment', async () => {
      // Arrange
      const equipmentData = { name: 'New Equipment', type: 'Bulldozer' };
      const createdEquipment = { id: 'new1', ...equipmentData };
      mockRequest.body = equipmentData;
      mockEquipmentService.createEquipment.mockResolvedValue(createdEquipment);

      // Act
      await controller.create(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockEquipmentService.createEquipment).toHaveBeenCalledWith(equipmentData);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: createdEquipment,
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Equipment created',
        expect.any(Object)
      );
    });

    it('should handle conflict error', async () => {
      // Arrange
      mockRequest.body = { id: 'existing', name: 'Existing Equipment' };
      const error = new Error('Equipment already exists');
      mockEquipmentService.createEquipment.mockRejectedValue(error);

      // Act
      await controller.create(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(createError.conflict).toHaveBeenCalledWith(
        'Equipment with this ID already exists'
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'Equipment creation failed - already exists',
        expect.any(Object)
      );
    });

    it('should handle general errors', async () => {
      // Arrange
      mockRequest.body = { name: 'New Equipment' };
      const error = new Error('Database error');
      mockEquipmentService.createEquipment.mockRejectedValue(error);

      // Act
      await controller.create(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create equipment',
        expect.any(Object)
      );
    });
  });

  describe('update', () => {
    it('should update equipment', async () => {
      // Arrange
      const updateData = { name: 'Updated Equipment' };
      const updatedEquipment = { id: 'equip1', ...updateData };
      mockRequest.params = { id: 'equip1' };
      mockRequest.body = updateData;
      mockEquipmentService.updateEquipment.mockResolvedValue(updatedEquipment);

      // Act
      await controller.update(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockEquipmentService.updateEquipment).toHaveBeenCalledWith('equip1', updateData);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedEquipment,
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Equipment updated',
        expect.any(Object)
      );
    });

    it('should handle not found error', async () => {
      // Arrange
      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = { name: 'Updated Equipment' };
      const error = new Error('Equipment not found');
      mockEquipmentService.updateEquipment.mockRejectedValue(error);

      // Act
      await controller.update(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(createError.notFound).toHaveBeenCalledWith('Equipment');
      expect(logger.warn).toHaveBeenCalledWith(
        'Equipment update failed - not found',
        expect.any(Object)
      );
    });

    it('should handle general errors', async () => {
      // Arrange
      mockRequest.params = { id: 'equip1' };
      mockRequest.body = { name: 'Updated Equipment' };
      const error = new Error('Database error');
      mockEquipmentService.updateEquipment.mockRejectedValue(error);

      // Act
      await controller.update(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to update equipment',
        expect.any(Object)
      );
    });
  });

  describe('delete', () => {
    it('should delete equipment', async () => {
      // Arrange
      mockRequest.params = { id: 'equip1' };
      mockEquipmentService.deleteEquipment.mockResolvedValue(undefined);

      // Act
      await controller.delete(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockEquipmentService.deleteEquipment).toHaveBeenCalledWith('equip1');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { deleted: true },
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Equipment deleted',
        expect.any(Object)
      );
    });

    it('should handle not found error', async () => {
      // Arrange
      mockRequest.params = { id: 'nonexistent' };
      const error = new Error('Equipment not found');
      mockEquipmentService.deleteEquipment.mockRejectedValue(error);

      // Act
      await controller.delete(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(createError.notFound).toHaveBeenCalledWith('Equipment');
      expect(logger.warn).toHaveBeenCalledWith(
        'Equipment deletion failed - not found',
        expect.any(Object)
      );
    });

    it('should handle general errors', async () => {
      // Arrange
      mockRequest.params = { id: 'equip1' };
      const error = new Error('Database error');
      mockEquipmentService.deleteEquipment.mockRejectedValue(error);

      // Act
      await controller.delete(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to delete equipment',
        expect.any(Object)
      );
    });
  });

  describe('getActive', () => {
    it('should return active equipment', async () => {
      // Arrange
      const mockResult = {
        data: [{ id: 'equip1', name: 'Equipment 1', status: 'active' }],
        pagination: { page: 1, limit: 10, total: 1 },
      };
      mockEquipmentService.getActiveEquipment.mockResolvedValue(mockResult);

      // Act
      await controller.getActive(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockEquipmentService.getActiveEquipment).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.data,
        timestamp: expect.any(Date),
        pagination: mockResult.pagination,
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Active equipment retrieved',
        expect.any(Object)
      );
    });

    it('should handle errors', async () => {
      // Arrange
      const error = new Error('Database error');
      mockEquipmentService.getActiveEquipment.mockRejectedValue(error);

      // Act
      await controller.getActive(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get active equipment',
        expect.any(Object)
      );
    });
  });

  describe('getMaintenanceDue', () => {
    it('should return equipment due for maintenance', async () => {
      // Arrange
      const mockEquipment = [
        { id: 'equip1', name: 'Equipment 1', maintenanceDue: true },
      ];
      mockEquipmentService.getMaintenanceDue.mockResolvedValue(mockEquipment);

      // Act
      await controller.getMaintenanceDue(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockEquipmentService.getMaintenanceDue).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockEquipment,
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Maintenance due equipment retrieved',
        expect.any(Object)
      );
    });

    it('should handle errors', async () => {
      // Arrange
      const error = new Error('Database error');
      mockEquipmentService.getMaintenanceDue.mockRejectedValue(error);

      // Act
      await controller.getMaintenanceDue(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get maintenance due equipment',
        expect.any(Object)
      );
    });
  });

  describe('getInactive', () => {
    it('should return inactive equipment with default time', async () => {
      // Arrange
      const mockEquipment = [
        { id: 'equip1', name: 'Equipment 1', status: 'inactive' },
      ];
      mockEquipmentService.getInactiveEquipment.mockResolvedValue(mockEquipment);

      // Act
      await controller.getInactive(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockEquipmentService.getInactiveEquipment).toHaveBeenCalledWith(expect.any(Date));
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockEquipment,
        timestamp: expect.any(Date),
        meta: {
          inactiveSince: expect.any(Date),
          totalFound: 1,
        },
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Inactive equipment retrieved',
        expect.any(Object)
      );
    });

    it('should return inactive equipment with specified time', async () => {
      // Arrange
      mockRequest.query = { since: '2023-01-01' };
      const mockEquipment = [
        { id: 'equip1', name: 'Equipment 1', status: 'inactive' },
      ];
      mockEquipmentService.getInactiveEquipment.mockResolvedValue(mockEquipment);

      // Act
      await controller.getInactive(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockEquipmentService.getInactiveEquipment).toHaveBeenCalledWith(new Date('2023-01-01'));
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should handle invalid date format', async () => {
      // Arrange
      mockRequest.query = { since: 'invalid-date' };

      // Act
      await controller.getInactive(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(createError.badRequest).toHaveBeenCalledWith('Invalid date format for "since" parameter');
    });

    it('should handle errors', async () => {
      // Arrange
      const error = new Error('Database error');
      mockEquipmentService.getInactiveEquipment.mockRejectedValue(error);

      // Act
      await controller.getInactive(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get inactive equipment',
        expect.any(Object)
      );
    });
  });

  describe('checkHealth', () => {
    it('should check equipment health', async () => {
      // Arrange
      mockRequest.params = { id: 'equip1' };
      const mockHealth = {
        status: 'good',
        issues: [],
        lastChecked: new Date(),
      };
      mockEquipmentService.checkEquipmentHealth.mockResolvedValue(mockHealth);

      // Act
      await controller.checkHealth(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockEquipmentService.checkEquipmentHealth).toHaveBeenCalledWith('equip1');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockHealth,
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Equipment health checked',
        expect.any(Object)
      );
    });

    it('should handle missing ID', async () => {
      // Arrange
      mockRequest.params = {};

      // Act
      await controller.checkHealth(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(createError.badRequest).toHaveBeenCalledWith('Equipment ID is required');
    });

    it('should handle not found error', async () => {
      // Arrange
      mockRequest.params = { id: 'nonexistent' };
      const error = new Error('Equipment not found');
      mockEquipmentService.checkEquipmentHealth.mockRejectedValue(error);

      // Act
      await controller.checkHealth(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(createError.notFound).toHaveBeenCalledWith('Equipment');
    });

    it('should handle general errors', async () => {
      // Arrange
      mockRequest.params = { id: 'equip1' };
      const error = new Error('Database error');
      mockEquipmentService.checkEquipmentHealth.mockRejectedValue(error);

      // Act
      await controller.checkHealth(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to check equipment health',
        expect.any(Object)
      );
    });
  });

  describe('getPositions', () => {
    it('should return equipment positions', async () => {
      // Arrange
      mockRequest.params = { id: 'equip1' };
      const mockResult = {
        data: [
          { latitude: 40.7128, longitude: -74.006, timestamp: new Date() },
        ],
        pagination: { page: 1, limit: 10, total: 1 },
      };
      mockEquipmentService.getEquipmentPositions.mockResolvedValue(mockResult);

      // Act
      await controller.getPositions(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockEquipmentService.getEquipmentPositions).toHaveBeenCalledWith('equip1', expect.any(Object));
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Equipment positions retrieved',
        expect.any(Object)
      );
    });

    it('should handle not found error', async () => {
      // Arrange
      mockRequest.params = { id: 'nonexistent' };
      const error = new Error('Equipment not found');
      mockEquipmentService.getEquipmentPositions.mockRejectedValue(error);

      // Act
      await controller.getPositions(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(createError.notFound).toHaveBeenCalledWith('Equipment');
    });

    it('should handle general errors', async () => {
      // Arrange
      mockRequest.params = { id: 'equip1' };
      const error = new Error('Database error');
      mockEquipmentService.getEquipmentPositions.mockRejectedValue(error);

      // Act
      await controller.getPositions(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get equipment positions',
        expect.any(Object)
      );
    });
  });

  describe('addPosition', () => {
    it('should add position to equipment', async () => {
      // Arrange
      mockRequest.params = { id: 'equip1' };
      mockRequest.body = {
        latitude: 40.7128,
        longitude: -74.006,
        altitude: 10,
        accuracy: 5,
        timestamp: new Date(),
      };
      mockEquipmentService.updateEquipmentPosition.mockResolvedValue(undefined);

      // Act
      await controller.addPosition(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockEquipmentService.updateEquipmentPosition).toHaveBeenCalledWith(
        'equip1',
        expect.objectContaining({
          latitude: 40.7128,
          longitude: -74.006,
          altitude: 10,
          accuracy: 5,
          timestamp: expect.any(Date),
          distanceTo: expect.any(Function),
        })
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          latitude: 40.7128,
          longitude: -74.006,
          altitude: 10,
          accuracy: 5,
          timestamp: expect.any(Date),
        }),
        timestamp: expect.any(Date),
      });
    });

    it('should use default values for optional position properties', async () => {
      // Arrange
      mockRequest.params = { id: 'equip1' };
      mockRequest.body = {
        latitude: 40.7128,
        longitude: -74.006,
      };
      mockEquipmentService.updateEquipmentPosition.mockResolvedValue(undefined);

      // Act
      await controller.addPosition(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockEquipmentService.updateEquipmentPosition).toHaveBeenCalledWith(
        'equip1',
        expect.objectContaining({
          latitude: 40.7128,
          longitude: -74.006,
          altitude: 0,
          accuracy: 2.5,
          timestamp: expect.any(Date),
        })
      );
    });

    it('should handle not found error', async () => {
      // Arrange
      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = {
        latitude: 40.7128,
        longitude: -74.006,
      };
      const error = new Error('Equipment not found');
      mockEquipmentService.updateEquipmentPosition.mockRejectedValue(error);

      // Act
      await controller.addPosition(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(createError.notFound).toHaveBeenCalledWith('Equipment');
    });

    it('should handle general errors', async () => {
      // Arrange
      mockRequest.params = { id: 'equip1' };
      mockRequest.body = {
        latitude: 40.7128,
        longitude: -74.006,
      };
      const error = new Error('Database error');
      mockEquipmentService.updateEquipmentPosition.mockRejectedValue(error);

      // Act
      await controller.addPosition(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to add position to equipment',
        expect.any(Object)
      );
    });
  });

  describe('getMovementAnalysis', () => {
    it('should return movement analysis', async () => {
      // Arrange
      mockRequest.params = { id: 'equip1' };
      const mockAnalysis = {
        totalDistance: 100,
        averageSpeed: 5,
        movementPeriods: [],
      };
      mockEquipmentService.getEquipmentMovementAnalysis.mockResolvedValue(mockAnalysis);

      // Act
      await controller.getMovementAnalysis(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockEquipmentService.getEquipmentMovementAnalysis).toHaveBeenCalledWith(
        'equip1',
        expect.any(Object)
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnalysis,
        timestamp: expect.any(Date),
      });
    });

    it('should handle not found error', async () => {
      // Arrange
      mockRequest.params = { id: 'nonexistent' };
      const error = new Error('Equipment not found');
      mockEquipmentService.getEquipmentMovementAnalysis.mockRejectedValue(error);

      // Act
      await controller.getMovementAnalysis(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(createError.notFound).toHaveBeenCalledWith('Equipment');
    });

    it('should handle general errors', async () => {
      // Arrange
      mockRequest.params = { id: 'equip1' };
      const error = new Error('Database error');
      mockEquipmentService.getEquipmentMovementAnalysis.mockRejectedValue(error);

      // Act
      await controller.getMovementAnalysis(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get movement analysis',
        expect.any(Object)
      );
    });
  });

  describe('getSummary', () => {
    it('should return equipment summary statistics', async () => {
      // Arrange
      const mockTotalEquipment = {
        data: [],
        pagination: { page: 1, limit: 1, total: 100 },
      };
      const mockActiveEquipment = {
        data: [],
        pagination: { page: 1, limit: 1, total: 80 },
      };
      const mockMaintenanceEquipment = [
        { id: 'equip1' },
        { id: 'equip2' },
      ];
      const mockInactiveEquipment = [
        { id: 'equip3' },
      ];

      mockEquipmentService.getAllEquipment.mockResolvedValue(mockTotalEquipment);
      mockEquipmentService.getActiveEquipment.mockResolvedValue(mockActiveEquipment);
      mockEquipmentService.getMaintenanceDue.mockResolvedValue(mockMaintenanceEquipment);
      mockEquipmentService.getInactiveEquipment.mockResolvedValue(mockInactiveEquipment);

      // Act
      await controller.getSummary(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockEquipmentService.getAllEquipment).toHaveBeenCalled();
      expect(mockEquipmentService.getActiveEquipment).toHaveBeenCalled();
      expect(mockEquipmentService.getMaintenanceDue).toHaveBeenCalled();
      expect(mockEquipmentService.getInactiveEquipment).toHaveBeenCalled();
      
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          totalEquipment: 100,
          activeEquipment: 80,
          maintenanceEquipment: 2,
          inactiveEquipment: 1,
          utilizationRate: 80,
        },
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Equipment summary retrieved',
        expect.any(Object)
      );
    });

    it('should handle zero equipment case for utilization rate', async () => {
      // Arrange
      const mockTotalEquipment = {
        data: [],
        pagination: { page: 1, limit: 1, total: 0 },
      };
      const mockActiveEquipment = {
        data: [],
        pagination: { page: 1, limit: 1, total: 0 },
      };
      
      mockEquipmentService.getAllEquipment.mockResolvedValue(mockTotalEquipment);
      mockEquipmentService.getActiveEquipment.mockResolvedValue(mockActiveEquipment);
      mockEquipmentService.getMaintenanceDue.mockResolvedValue([]);
      mockEquipmentService.getInactiveEquipment.mockResolvedValue([]);

      // Act
      await controller.getSummary(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            utilizationRate: 0,
          }),
        })
      );
    });

    it('should handle errors', async () => {
      // Arrange
      const error = new Error('Database error');
      mockEquipmentService.getAllEquipment.mockRejectedValue(error);

      // Act
      await controller.getSummary(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get equipment summary',
        expect.any(Object)
      );
    });
  });
});
// </test_code>
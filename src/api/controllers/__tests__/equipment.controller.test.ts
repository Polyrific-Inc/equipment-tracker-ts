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
    startTime: new Date('2023-01-01'),
    endTime: new Date('2023-01-02'),
  }),
}));

describe('EquipmentController', () => {
  let controller: EquipmentController;
  let mockEquipmentService: any;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock equipment service
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

    // Create controller instance
    controller = new EquipmentController(mockEquipmentService);

    // Create mock request, response, and next function
    mockReq = {
      params: { id: 'equip-123' },
      query: {},
      body: {},
      user: { id: 'user-123' },
    };

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('list', () => {
    it('should return a list of equipment', async () => {
      const mockResult = {
        data: [{ id: 'equip-123', name: 'Bulldozer' }],
        pagination: { page: 1, limit: 10, total: 1 },
      };
      mockEquipmentService.findEquipment.mockResolvedValue(mockResult);

      await controller.list(mockReq as any, mockRes as any, mockNext);

      expect(mockEquipmentService.findEquipment).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith('Equipment list retrieved', expect.any(Object));
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockEquipmentService.findEquipment.mockRejectedValue(error);

      await controller.list(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith('Failed to list equipment', expect.any(Object));
    });
  });

  describe('getById', () => {
    it('should return equipment by ID', async () => {
      const mockEquipment = { id: 'equip-123', name: 'Bulldozer' };
      mockEquipmentService.getEquipment.mockResolvedValue(mockEquipment);

      await controller.getById(mockReq as any, mockRes as any, mockNext);

      expect(mockEquipmentService.getEquipment).toHaveBeenCalledWith('equip-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockEquipment,
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith('Equipment retrieved', expect.any(Object));
    });

    it('should handle not found errors', async () => {
      const error = new Error('Equipment not found');
      mockEquipmentService.getEquipment.mockRejectedValue(error);

      await controller.getById(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(createError.notFound).toHaveBeenCalledWith('Equipment');
      expect(logger.warn).toHaveBeenCalledWith('Equipment not found', expect.any(Object));
    });

    it('should handle other errors', async () => {
      const error = new Error('Database error');
      mockEquipmentService.getEquipment.mockRejectedValue(error);

      await controller.getById(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith('Failed to get equipment', expect.any(Object));
    });
  });

  describe('create', () => {
    it('should create new equipment', async () => {
      const equipmentData = { name: 'New Bulldozer', type: 'heavy' };
      const createdEquipment = { id: 'equip-123', ...equipmentData };
      mockReq.body = equipmentData;
      mockEquipmentService.createEquipment.mockResolvedValue(createdEquipment);

      await controller.create(mockReq as any, mockRes as any, mockNext);

      expect(mockEquipmentService.createEquipment).toHaveBeenCalledWith(equipmentData);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: createdEquipment,
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith('Equipment created', expect.any(Object));
    });

    it('should handle conflict errors', async () => {
      const error = new Error('Equipment already exists');
      mockReq.body = { id: 'equip-123', name: 'Bulldozer' };
      mockEquipmentService.createEquipment.mockRejectedValue(error);

      await controller.create(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(createError.conflict).toHaveBeenCalledWith('Equipment with this ID already exists');
      expect(logger.warn).toHaveBeenCalledWith(
        'Equipment creation failed - already exists',
        expect.any(Object)
      );
    });

    it('should handle other errors', async () => {
      const error = new Error('Database error');
      mockEquipmentService.createEquipment.mockRejectedValue(error);

      await controller.create(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith('Failed to create equipment', expect.any(Object));
    });
  });

  describe('update', () => {
    it('should update equipment', async () => {
      const updateData = { name: 'Updated Bulldozer' };
      const updatedEquipment = { id: 'equip-123', ...updateData };
      mockReq.body = updateData;
      mockEquipmentService.updateEquipment.mockResolvedValue(updatedEquipment);

      await controller.update(mockReq as any, mockRes as any, mockNext);

      expect(mockEquipmentService.updateEquipment).toHaveBeenCalledWith('equip-123', updateData);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedEquipment,
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith('Equipment updated', expect.any(Object));
    });

    it('should handle not found errors', async () => {
      const error = new Error('Equipment not found');
      mockReq.body = { name: 'Updated Bulldozer' };
      mockEquipmentService.updateEquipment.mockRejectedValue(error);

      await controller.update(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(createError.notFound).toHaveBeenCalledWith('Equipment');
      expect(logger.warn).toHaveBeenCalledWith(
        'Equipment update failed - not found',
        expect.any(Object)
      );
    });

    it('should handle other errors', async () => {
      const error = new Error('Database error');
      mockEquipmentService.updateEquipment.mockRejectedValue(error);

      await controller.update(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith('Failed to update equipment', expect.any(Object));
    });
  });

  describe('delete', () => {
    it('should delete equipment', async () => {
      mockEquipmentService.deleteEquipment.mockResolvedValue(undefined);

      await controller.delete(mockReq as any, mockRes as any, mockNext);

      expect(mockEquipmentService.deleteEquipment).toHaveBeenCalledWith('equip-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { deleted: true },
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith('Equipment deleted', expect.any(Object));
    });

    it('should handle not found errors', async () => {
      const error = new Error('Equipment not found');
      mockEquipmentService.deleteEquipment.mockRejectedValue(error);

      await controller.delete(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(createError.notFound).toHaveBeenCalledWith('Equipment');
      expect(logger.warn).toHaveBeenCalledWith(
        'Equipment deletion failed - not found',
        expect.any(Object)
      );
    });

    it('should handle other errors', async () => {
      const error = new Error('Database error');
      mockEquipmentService.deleteEquipment.mockRejectedValue(error);

      await controller.delete(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith('Failed to delete equipment', expect.any(Object));
    });
  });

  describe('getActive', () => {
    it('should return active equipment', async () => {
      const mockResult = {
        data: [{ id: 'equip-123', name: 'Active Bulldozer' }],
        pagination: { page: 1, limit: 10, total: 1 },
      };
      mockEquipmentService.getActiveEquipment.mockResolvedValue(mockResult);

      await controller.getActive(mockReq as any, mockRes as any, mockNext);

      expect(mockEquipmentService.getActiveEquipment).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        sortBy: undefined,
        sortOrder: undefined,
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.data,
        timestamp: expect.any(Date),
        pagination: mockResult.pagination,
      });
      expect(logger.info).toHaveBeenCalledWith('Active equipment retrieved', expect.any(Object));
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockEquipmentService.getActiveEquipment.mockRejectedValue(error);

      await controller.getActive(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get active equipment',
        expect.any(Object)
      );
    });
  });

  describe('getMaintenanceDue', () => {
    it('should return equipment due for maintenance', async () => {
      const mockEquipment = [{ id: 'equip-123', name: 'Maintenance Due Bulldozer' }];
      mockEquipmentService.getMaintenanceDue.mockResolvedValue(mockEquipment);

      await controller.getMaintenanceDue(mockReq as any, mockRes as any, mockNext);

      expect(mockEquipmentService.getMaintenanceDue).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
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
      const error = new Error('Database error');
      mockEquipmentService.getMaintenanceDue.mockRejectedValue(error);

      await controller.getMaintenanceDue(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get maintenance due equipment',
        expect.any(Object)
      );
    });
  });

  describe('getInactive', () => {
    it('should return inactive equipment with default time', async () => {
      const mockEquipment = [{ id: 'equip-123', name: 'Inactive Bulldozer' }];
      mockEquipmentService.getInactiveEquipment.mockResolvedValue(mockEquipment);

      await controller.getInactive(mockReq as any, mockRes as any, mockNext);

      expect(mockEquipmentService.getInactiveEquipment).toHaveBeenCalledWith(expect.any(Date));
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockEquipment,
        timestamp: expect.any(Date),
        meta: {
          inactiveSince: expect.any(Date),
          totalFound: 1,
        },
      });
      expect(logger.info).toHaveBeenCalledWith('Inactive equipment retrieved', expect.any(Object));
    });

    it('should return inactive equipment with specified time', async () => {
      const sinceDate = '2023-01-01T00:00:00Z';
      mockReq.query = { since: sinceDate };
      const mockEquipment = [{ id: 'equip-123', name: 'Inactive Bulldozer' }];
      mockEquipmentService.getInactiveEquipment.mockResolvedValue(mockEquipment);

      await controller.getInactive(mockReq as any, mockRes as any, mockNext);

      expect(mockEquipmentService.getInactiveEquipment).toHaveBeenCalledWith(new Date(sinceDate));
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockEquipment,
        timestamp: expect.any(Date),
        meta: {
          inactiveSince: new Date(sinceDate),
          totalFound: 1,
        },
      });
    });

    it('should handle invalid date format', async () => {
      mockReq.query = { since: 'invalid-date' };

      await controller.getInactive(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(createError.badRequest).toHaveBeenCalledWith(
        'Invalid date format for "since" parameter'
      );
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockEquipmentService.getInactiveEquipment.mockRejectedValue(error);

      await controller.getInactive(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get inactive equipment',
        expect.any(Object)
      );
    });
  });

  describe('checkHealth', () => {
    it('should check equipment health', async () => {
      const mockHealth = {
        status: 'good',
        issues: [],
        lastChecked: new Date(),
      };
      mockEquipmentService.checkEquipmentHealth.mockResolvedValue(mockHealth);

      await controller.checkHealth(mockReq as any, mockRes as any, mockNext);

      expect(mockEquipmentService.checkEquipmentHealth).toHaveBeenCalledWith('equip-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockHealth,
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith('Equipment health checked', expect.any(Object));
    });

    it('should handle missing ID', async () => {
      mockReq.params = {};

      await controller.checkHealth(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(createError.badRequest).toHaveBeenCalledWith('Equipment ID is required');
    });

    it('should handle not found errors', async () => {
      const error = new Error('Equipment not found');
      mockEquipmentService.checkEquipmentHealth.mockRejectedValue(error);

      await controller.checkHealth(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(createError.notFound).toHaveBeenCalledWith('Equipment');
    });

    it('should handle other errors', async () => {
      const error = new Error('Database error');
      mockEquipmentService.checkEquipmentHealth.mockRejectedValue(error);

      await controller.checkHealth(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to check equipment health',
        expect.any(Object)
      );
    });
  });

  describe('getPositions', () => {
    it('should return equipment positions', async () => {
      const mockResult = {
        data: [{ latitude: 40.7128, longitude: -74.006 }],
        pagination: { page: 1, limit: 10, total: 1 },
      };
      mockEquipmentService.getEquipmentPositions.mockResolvedValue(mockResult);

      await controller.getPositions(mockReq as any, mockRes as any, mockNext);

      expect(mockEquipmentService.getEquipmentPositions).toHaveBeenCalledWith(
        'equip-123',
        expect.any(Object)
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith('Equipment positions retrieved', expect.any(Object));
    });

    it('should handle not found errors', async () => {
      const error = new Error('Equipment not found');
      mockEquipmentService.getEquipmentPositions.mockRejectedValue(error);

      await controller.getPositions(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(createError.notFound).toHaveBeenCalledWith('Equipment');
    });

    it('should handle other errors', async () => {
      const error = new Error('Database error');
      mockEquipmentService.getEquipmentPositions.mockRejectedValue(error);

      await controller.getPositions(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get equipment positions',
        expect.any(Object)
      );
    });
  });

  describe('addPosition', () => {
    it('should add position to equipment', async () => {
      const positionData = {
        latitude: 40.7128,
        longitude: -74.006,
        altitude: 10,
        accuracy: 5,
        timestamp: new Date(),
      };
      mockReq.body = positionData;
      mockEquipmentService.updateEquipmentPosition.mockResolvedValue(undefined);

      await controller.addPosition(mockReq as any, mockRes as any, mockNext);

      expect(mockEquipmentService.updateEquipmentPosition).toHaveBeenCalledWith(
        'equip-123',
        expect.objectContaining({
          latitude: 40.7128,
          longitude: -74.006,
          altitude: 10,
          accuracy: 5,
          timestamp: expect.any(Date),
          distanceTo: expect.any(Function),
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
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

    it('should use default values for optional fields', async () => {
      const positionData = {
        latitude: 40.7128,
        longitude: -74.006,
      };
      mockReq.body = positionData;
      mockEquipmentService.updateEquipmentPosition.mockResolvedValue(undefined);

      await controller.addPosition(mockReq as any, mockRes as any, mockNext);

      expect(mockEquipmentService.updateEquipmentPosition).toHaveBeenCalledWith(
        'equip-123',
        expect.objectContaining({
          latitude: 40.7128,
          longitude: -74.006,
          altitude: 0,
          accuracy: 2.5,
          timestamp: expect.any(Date),
        })
      );
    });

    it('should handle not found errors', async () => {
      const error = new Error('Equipment not found');
      mockReq.body = { latitude: 40.7128, longitude: -74.006 };
      mockEquipmentService.updateEquipmentPosition.mockRejectedValue(error);

      await controller.addPosition(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(createError.notFound).toHaveBeenCalledWith('Equipment');
    });

    it('should handle other errors', async () => {
      const error = new Error('Database error');
      mockEquipmentService.updateEquipmentPosition.mockRejectedValue(error);

      await controller.addPosition(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to add position to equipment',
        expect.any(Object)
      );
    });
  });

  describe('getMovementAnalysis', () => {
    it('should return movement analysis', async () => {
      const mockAnalysis = {
        totalDistance: 100,
        averageSpeed: 10,
        movementPeriods: [],
      };
      mockEquipmentService.getEquipmentMovementAnalysis.mockResolvedValue(mockAnalysis);

      await controller.getMovementAnalysis(mockReq as any, mockRes as any, mockNext);

      expect(mockEquipmentService.getEquipmentMovementAnalysis).toHaveBeenCalledWith(
        'equip-123',
        expect.any(Object)
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnalysis,
        timestamp: expect.any(Date),
      });
    });

    it('should handle not found errors', async () => {
      const error = new Error('Equipment not found');
      mockEquipmentService.getEquipmentMovementAnalysis.mockRejectedValue(error);

      await controller.getMovementAnalysis(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(createError.notFound).toHaveBeenCalledWith('Equipment');
    });

    it('should handle other errors', async () => {
      const error = new Error('Database error');
      mockEquipmentService.getEquipmentMovementAnalysis.mockRejectedValue(error);

      await controller.getMovementAnalysis(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get movement analysis',
        expect.any(Object)
      );
    });
  });

  describe('getSummary', () => {
    it('should return equipment summary statistics', async () => {
      mockEquipmentService.getAllEquipment.mockResolvedValue({
        data: [],
        pagination: { total: 100 },
      });
      mockEquipmentService.getActiveEquipment.mockResolvedValue({
        data: [],
        pagination: { total: 80 },
      });
      mockEquipmentService.getMaintenanceDue.mockResolvedValue([{}, {}, {}]);
      mockEquipmentService.getInactiveEquipment.mockResolvedValue([{}, {}]);

      await controller.getSummary(mockReq as any, mockRes as any, mockNext);

      expect(mockEquipmentService.getAllEquipment).toHaveBeenCalled();
      expect(mockEquipmentService.getActiveEquipment).toHaveBeenCalled();
      expect(mockEquipmentService.getMaintenanceDue).toHaveBeenCalled();
      expect(mockEquipmentService.getInactiveEquipment).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          totalEquipment: 100,
          activeEquipment: 80,
          maintenanceEquipment: 3,
          inactiveEquipment: 2,
          utilizationRate: 80,
        },
        timestamp: expect.any(Date),
      });
      expect(logger.info).toHaveBeenCalledWith('Equipment summary retrieved', expect.any(Object));
    });

    it('should handle zero total equipment case', async () => {
      mockEquipmentService.getAllEquipment.mockResolvedValue({
        data: [],
        pagination: { total: 0 },
      });
      mockEquipmentService.getActiveEquipment.mockResolvedValue({
        data: [],
        pagination: { total: 0 },
      });
      mockEquipmentService.getMaintenanceDue.mockResolvedValue([]);
      mockEquipmentService.getInactiveEquipment.mockResolvedValue([]);

      await controller.getSummary(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          totalEquipment: 0,
          activeEquipment: 0,
          maintenanceEquipment: 0,
          inactiveEquipment: 0,
          utilizationRate: 0,
        },
        timestamp: expect.any(Date),
      });
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      mockEquipmentService.getAllEquipment.mockRejectedValue(error);

      await controller.getSummary(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get equipment summary',
        expect.any(Object)
      );
    });
  });
});
// </test_code>
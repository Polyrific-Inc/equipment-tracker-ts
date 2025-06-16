/**
 * Unit tests for query parser utilities
 */

import {
  parseEquipmentQuery,
  parsePositionQuery,
  parsePaginationQuery,
  parseTimeRangeQuery,
  parseGeographicBounds,
  validatePagination,
  sanitizeEquipmentQuery,
  sanitizePositionQuery,
} from '../../../src/infrastructure/utils/query-parser.js';
import { EquipmentType, EquipmentStatus, PositionSource } from '../../../src/types/index.js';

describe('Query Parser', () => {
  describe('parseEquipmentQuery', () => {
    it('should parse single equipment type', () => {
      const query = { type: 'forklift' };
      const result = parseEquipmentQuery(query);
      
      expect(result.type).toBe(EquipmentType.Forklift);
    });

    it('should parse multiple equipment types', () => {
      const query = { type: 'forklift,crane,truck' };
      const result = parseEquipmentQuery(query);
      
      expect(result.type).toEqual([
        EquipmentType.Forklift,
        EquipmentType.Crane,
        EquipmentType.Truck,
      ]);
    });

    it('should parse single equipment status', () => {
      const query = { status: 'active' };
      const result = parseEquipmentQuery(query);
      
      expect(result.status).toBe(EquipmentStatus.Active);
    });

    it('should parse multiple equipment statuses', () => {
      const query = { status: 'active,inactive,maintenance' };
      const result = parseEquipmentQuery(query);
      
      expect(result.status).toEqual([
        EquipmentStatus.Active,
        EquipmentStatus.Inactive,
        EquipmentStatus.Maintenance,
      ]);
    });

    it('should parse date fields correctly', () => {
      const query = {
        createdAfter: '2023-01-01T00:00:00Z',
        createdBefore: '2023-12-31T23:59:59Z',
        updatedAfter: '2023-06-01T00:00:00Z',
        updatedBefore: '2023-06-30T23:59:59Z',
      };
      const result = parseEquipmentQuery(query);
      
      expect(result.createdAfter).toEqual(new Date('2023-01-01T00:00:00Z'));
      expect(result.createdBefore).toEqual(new Date('2023-12-31T23:59:59Z'));
      expect(result.updatedAfter).toEqual(new Date('2023-06-01T00:00:00Z'));
      expect(result.updatedBefore).toEqual(new Date('2023-06-30T23:59:59Z'));
    });

    it('should parse boolean fields correctly', () => {
      const query = {
        hasPosition: 'true',
        isMoving: 'false',
      };
      const result = parseEquipmentQuery(query);
      
      expect(result.hasPosition).toBe(true);
      expect(result.isMoving).toBe(false);
    });

    it('should handle mixed case boolean values', () => {
      const query = {
        hasPosition: 'TRUE',
        isMoving: 'False',
      };
      const result = parseEquipmentQuery(query);
      
      expect(result.hasPosition).toBe(true);
      expect(result.isMoving).toBe(false);
    });

    it('should ignore invalid date strings', () => {
      const query = {
        createdAfter: 'invalid-date',
        createdBefore: 'not-a-date',
      };
      const result = parseEquipmentQuery(query);
      
      expect(result.createdAfter).toBeUndefined();
      expect(result.createdBefore).toBeUndefined();
    });

    it('should ignore invalid boolean strings', () => {
      const query = {
        hasPosition: 'maybe',
        isMoving: 'yes',
      };
      const result = parseEquipmentQuery(query);
      
      expect(result.hasPosition).toBeUndefined();
      expect(result.isMoving).toBeUndefined();
    });

    it('should handle empty query object', () => {
      const query = {};
      const result = parseEquipmentQuery(query);
      
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should handle comma-separated values with spaces', () => {
      const query = { type: ' forklift , crane , truck ' };
      const result = parseEquipmentQuery(query);
      
      expect(result.type).toEqual([
        EquipmentType.Forklift,
        EquipmentType.Crane,
        EquipmentType.Truck,
      ]);
    });

    it('should filter out empty values in comma-separated strings', () => {
      const query = { type: 'forklift,,crane,' };
      const result = parseEquipmentQuery(query);
      
      expect(result.type).toEqual([EquipmentType.Forklift, EquipmentType.Crane]);
    });
  });

  describe('parsePositionQuery', () => {
    it('should parse single equipment ID', () => {
      const query = { equipmentId: 'eq-123' };
      const result = parsePositionQuery(query);
      
      expect(result.equipmentId).toBe('eq-123');
    });

    it('should parse multiple equipment IDs', () => {
      const query = { equipmentId: 'eq-123,eq-456,eq-789' };
      const result = parsePositionQuery(query);
      
      expect(result.equipmentId).toEqual(['eq-123', 'eq-456', 'eq-789']);
    });

    it('should parse time range with both start and end', () => {
      const query = {
        startTime: '2023-01-01T00:00:00Z',
        endTime: '2023-01-02T00:00:00Z',
      };
      const result = parsePositionQuery(query);
      
      expect(result.timeRange).toEqual({
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-02T00:00:00Z'),
      });
    });

    it('should parse time range with only start time', () => {
      const query = { startTime: '2023-01-01T00:00:00Z' };
      const result = parsePositionQuery(query);
      
      expect(result.timeRange?.start).toEqual(new Date('2023-01-01T00:00:00Z'));
      expect(result.timeRange?.end).toBeInstanceOf(Date);
    });

    it('should parse time range with only end time', () => {
      const query = { endTime: '2023-01-02T00:00:00Z' };
      const result = parsePositionQuery(query);
      
      expect(result.timeRange?.start).toEqual(new Date(0)); // Unix epoch
      expect(result.timeRange?.end).toEqual(new Date('2023-01-02T00:00:00Z'));
    });

    it('should parse geographic bounds correctly', () => {
      const query = {
        minLat: '37.7',
        maxLat: '37.8',
        minLng: '-122.5',
        maxLng: '-122.4',
      };
      const result = parsePositionQuery(query);
      
      expect(result.bounds).toEqual({
        southWest: { lat: 37.7, lng: -122.5 },
        northEast: { lat: 37.8, lng: -122.4 },
      });
    });

    it('should not set bounds if any coordinate is missing', () => {
      const query = {
        minLat: '37.7',
        maxLat: '37.8',
        minLng: '-122.5',
        // maxLng missing
      };
      const result = parsePositionQuery(query);
      
      expect(result.bounds).toBeUndefined();
    });

    it('should parse accuracy range', () => {
      const query = {
        minAccuracy: '1.0',
        maxAccuracy: '10.0',
      };
      const result = parsePositionQuery(query);
      
      expect(result.minAccuracy).toBe(1.0);
      expect(result.maxAccuracy).toBe(10.0);
    });

    it('should parse single position source', () => {
      const query = { source: 'gps' };
      const result = parsePositionQuery(query);
      
      expect(result.source).toBe(PositionSource.GPS);
    });

    it('should parse multiple position sources', () => {
      const query = { source: 'gps,manual,simulation' };
      const result = parsePositionQuery(query);
      
      expect(result.source).toEqual([
        PositionSource.GPS,
        PositionSource.Manual,
        PositionSource.Simulation,
      ]);
    });

    it('should parse speed-related filters', () => {
      const query = {
        hasSpeed: 'true',
        minSpeed: '5.0',
        maxSpeed: '25.0',
      };
      const result = parsePositionQuery(query);
      
      expect(result.hasSpeed).toBe(true);
      expect(result.minSpeed).toBe(5.0);
      expect(result.maxSpeed).toBe(25.0);
    });

    it('should handle invalid numeric values', () => {
      const query = {
        minLat: 'not-a-number',
        maxAccuracy: 'invalid',
        minSpeed: 'abc',
      };
      const result = parsePositionQuery(query);
      
      expect(result.bounds).toBeUndefined();
      expect(result.maxAccuracy).toBeUndefined();
      expect(result.minSpeed).toBeUndefined();
    });

    it('should handle empty query object', () => {
      const query = {};
      const result = parsePositionQuery(query);
      
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('parsePaginationQuery', () => {
    it('should parse valid pagination parameters', () => {
      const query = { page: '2', limit: '50' };
      const result = parsePaginationQuery(query);
      
      expect(result).toEqual({
        page: 2,
        limit: 50,
      });
    });

    it('should use default values for missing parameters', () => {
      const query = {};
      const result = parsePaginationQuery(query);
      
      expect(result).toEqual({
        page: 1,
        limit: 20,
      });
    });

    it('should handle invalid page and limit values', () => {
      const query = { page: 'abc', limit: 'xyz' };
      const result = parsePaginationQuery(query);
      
      expect(result).toEqual({
        page: 1,
        limit: 20,
      });
    });

    it('should include sortBy when provided', () => {
      const query = { page: '1', limit: '10', sortBy: 'name' };
      const result = parsePaginationQuery(query);
      
      expect(result).toEqual({
        page: 1,
        limit: 10,
        sortBy: 'name',
      });
    });

    it('should include valid sortOrder', () => {
      const query = { page: '1', limit: '10', sortOrder: 'desc' as const };
      const result = parsePaginationQuery(query);
      
      expect(result).toEqual({
        page: 1,
        limit: 10,
        sortOrder: 'desc',
      });
    });

    it('should ignore invalid sortOrder', () => {
      const query = { page: '1', limit: '10', sortOrder: 'invalid' as any };
      const result = parsePaginationQuery(query);
      
      expect(result).toEqual({
        page: 1,
        limit: 10,
      });
    });

    it('should handle zero and negative values', () => {
      const query = { page: '0', limit: '-5' };
      const result = parsePaginationQuery(query);
      
      expect(result.page).toBe(0); // Parser doesn't validate, just parses
      expect(result.limit).toBe(-5);
    });
  });

  describe('validatePagination', () => {
    it('should enforce minimum page value of 1', () => {
      const pagination = { page: 0, limit: 20 };
      const result = validatePagination(pagination);
      
      expect(result.page).toBe(1);
    });

    it('should enforce minimum limit value of 1', () => {
      const pagination = { page: 1, limit: 0 };
      const result = validatePagination(pagination);
      
      expect(result.limit).toBe(1);
    });

    it('should enforce maximum limit value of 100', () => {
      const pagination = { page: 1, limit: 200 };
      const result = validatePagination(pagination);
      
      expect(result.limit).toBe(100);
    });

    it('should preserve valid values', () => {
      const pagination = { page: 5, limit: 50, sortBy: 'name', sortOrder: 'asc' as const };
      const result = validatePagination(pagination);
      
      expect(result).toEqual({
        page: 5,
        limit: 50,
        sortBy: 'name',
        sortOrder: 'asc',
      });
    });

    it('should handle negative page values', () => {
      const pagination = { page: -5, limit: 20 };
      const result = validatePagination(pagination);
      
      expect(result.page).toBe(1);
    });
  });

  describe('parseTimeRangeQuery', () => {
    it('should parse time range with both start and end', () => {
      const query = {
        start: '2023-01-01T00:00:00Z',
        end: '2023-01-02T00:00:00Z',
      };
      const result = parseTimeRangeQuery(query);
      
      expect(result).toEqual({
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-01-02T00:00:00Z'),
      });
    });

    it('should parse time range with only start', () => {
      const query = { start: '2023-01-01T00:00:00Z' };
      const result = parseTimeRangeQuery(query);
      
      expect(result?.start).toEqual(new Date('2023-01-01T00:00:00Z'));
      expect(result?.end).toBeInstanceOf(Date);
    });

    it('should parse time range with only end', () => {
      const query = { end: '2023-01-02T00:00:00Z' };
      const result = parseTimeRangeQuery(query);
      
      expect(result?.start).toEqual(new Date(0));
      expect(result?.end).toEqual(new Date('2023-01-02T00:00:00Z'));
    });

    it('should return undefined for empty query', () => {
      const query = {};
      const result = parseTimeRangeQuery(query);
      
      expect(result).toBeUndefined();
    });

    it('should handle invalid date strings', () => {
      const query = {
        start: 'invalid-date',
        end: 'not-a-date',
      };
      const result = parseTimeRangeQuery(query);
      
      expect(result).toBeUndefined();
    });
  });

  describe('parseGeographicBounds', () => {
    it('should parse valid JSON bounds', () => {
      const boundsJson = JSON.stringify({
        southWest: { lat: 37.7, lng: -122.5 },
        northEast: { lat: 37.8, lng: -122.4 },
      });
      const result = parseGeographicBounds(boundsJson);
      
      expect(result).toEqual({
        southWest: { lat: 37.7, lng: -122.5 },
        northEast: { lat: 37.8, lng: -122.4 },
      });
    });

    it('should return undefined for invalid JSON', () => {
      const result = parseGeographicBounds('invalid-json');
      expect(result).toBeUndefined();
    });

    it('should return undefined for undefined input', () => {
      const result = parseGeographicBounds(undefined);
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const result = parseGeographicBounds('');
      expect(result).toBeUndefined();
    });
  });

  describe('sanitizeEquipmentQuery', () => {
    it('should combine equipment filter and pagination', () => {
      const query = {
        type: 'forklift',
        status: 'active',
        page: '2',
        limit: '25',
      };
      const result = sanitizeEquipmentQuery(query);
      
      expect(result.filter.type).toBe(EquipmentType.Forklift);
      expect(result.filter.status).toBe(EquipmentStatus.Active);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 25,
      });
    });

    it('should validate pagination parameters', () => {
      const query = {
        type: 'crane',
        page: '0', // Invalid
        limit: '200', // Too high
      };
      const result = sanitizeEquipmentQuery(query);
      
      expect(result.filter.type).toBe(EquipmentType.Crane);
      expect(result.pagination.page).toBe(1); // Corrected
      expect(result.pagination.limit).toBe(100); // Capped
    });

    it('should handle empty query', () => {
      const query = {};
      const result = sanitizeEquipmentQuery(query);
      
      expect(Object.keys(result.filter)).toHaveLength(0);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
      });
    });
  });

  describe('sanitizePositionQuery', () => {
    it('should combine position filter and pagination', () => {
      const query = {
        equipmentId: 'eq-123',
        source: 'gps',
        page: '1',
        limit: '50',
      };
      const result = sanitizePositionQuery(query);
      
      expect(result.filter.equipmentId).toBe('eq-123');
      expect(result.filter.source).toBe(PositionSource.GPS);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 50,
      });
    });

    it('should validate pagination parameters', () => {
      const query = {
        equipmentId: 'eq-456',
        page: '-1', // Invalid
        limit: '500', // Too high
      };
      const result = sanitizePositionQuery(query);
      
      expect(result.filter.equipmentId).toBe('eq-456');
      expect(result.pagination.page).toBe(1); // Corrected
      expect(result.pagination.limit).toBe(100); // Capped
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null and undefined values gracefully', () => {
      const query: any = {
        type: undefined,
        status: null,
        page: undefined,
        limit: null,
      };
      
      const equipmentResult = parseEquipmentQuery(query);
      const paginationResult = parsePaginationQuery(query);
      
      expect(equipmentResult.type).toBeUndefined();
      expect(equipmentResult.status).toBeUndefined();
      expect(paginationResult.page).toBe(1);
      expect(paginationResult.limit).toBe(20);
    });

    it('should handle whitespace-only strings', () => {
      const query = {
        type: '   ',
        hasPosition: '  ',
        page: ' \t ',
      };
      
      const equipmentResult = parseEquipmentQuery(query);
      const paginationResult = parsePaginationQuery(query);
      
      expect(equipmentResult.type).toBeUndefined();
      expect(equipmentResult.hasPosition).toBeUndefined();
      // Note: Number(' \t ') actually returns 0, so parseNumber returns 0, not undefined
      expect(paginationResult.page).toBe(0);
    });

    it('should handle very large numbers', () => {
      const query = {
        page: '999999999999',
        limit: '888888888888',
        minAccuracy: '1e+100',
      };
      
      const paginationResult = parsePaginationQuery(query);
      const positionResult = parsePositionQuery({ minAccuracy: '1e+100' });
      
      expect(paginationResult.page).toBe(999999999999);
      expect(paginationResult.limit).toBe(888888888888);
      expect(positionResult.minAccuracy).toBe(1e+100);
    });

    it('should handle special float values', () => {
      const query = {
        minLat: 'Infinity',
        maxLat: '-Infinity',
        minLng: 'NaN',
      };
      
      const result = parsePositionQuery(query);
      
      // These should parse as their respective special values
      expect(result.bounds).toBeUndefined(); // Because NaN makes the bounds invalid
    });

    it('should handle mixed valid and invalid comma-separated values', () => {
      const query = {
        type: 'forklift,invalid-type,crane',
        status: 'active,,unknown,invalid-status',
      };
      
      const result = parseEquipmentQuery(query);
      
      // Should include valid values and invalid ones (type system will catch invalid enum values)
      expect(Array.isArray(result.type)).toBe(true);
      expect(Array.isArray(result.status)).toBe(true);
    });

    it('should handle extremely long strings', () => {
      const longString = 'a'.repeat(10000);
      const query = {
        type: longString,
        equipmentId: longString,
      };
      
      const equipmentResult = parseEquipmentQuery(query);
      const positionResult = parsePositionQuery(query);
      
      // Should handle gracefully without crashing
      expect(typeof equipmentResult.type).toBe('string');
      expect(typeof positionResult.equipmentId).toBe('string');
    });

    it('should handle date edge cases', () => {
      const query = {
        createdAfter: '1970-01-01T00:00:00Z', // Unix epoch
        createdBefore: '2038-01-19T03:14:07Z', // Year 2038 problem
        startTime: '0000-01-01T00:00:00Z', // Year 0
        endTime: '9999-12-31T23:59:59Z', // Far future
      };
      
      const equipmentResult = parseEquipmentQuery(query);
      const positionResult = parsePositionQuery(query);
      
      expect(equipmentResult.createdAfter).toEqual(new Date('1970-01-01T00:00:00Z'));
      expect(equipmentResult.createdBefore).toEqual(new Date('2038-01-19T03:14:07Z'));
      expect(positionResult.timeRange?.start).toEqual(new Date('0000-01-01T00:00:00Z'));
      expect(positionResult.timeRange?.end).toEqual(new Date('9999-12-31T23:59:59Z'));
    });
  });

  describe('Performance considerations', () => {
    it('should handle large comma-separated lists efficiently', () => {
      const largeList = Array.from({ length: 1000 }, (_, i) => `item-${i}`).join(',');
      const query = { equipmentId: largeList };
      
      const start = process.hrtime.bigint();
      const result = parsePositionQuery(query);
      const end = process.hrtime.bigint();
      
      const duration = Number(end - start) / 1000000; // Convert to milliseconds
      
      expect(Array.isArray(result.equipmentId)).toBe(true);
      expect((result.equipmentId as string[]).length).toBe(1000);
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should parse multiple complex queries quickly', () => {
      const complexQuery = {
        type: 'forklift,crane,truck,bulldozer,excavator',
        status: 'active,inactive,maintenance',
        equipmentId: Array.from({ length: 100 }, (_, i) => `eq-${i}`).join(','),
        source: 'gps,manual,simulation',
        hasPosition: 'true',
        isMoving: 'false',
        hasSpeed: 'true',
        minLat: '37.7',
        maxLat: '37.8',
        minLng: '-122.5',
        maxLng: '-122.4',
        minAccuracy: '1.0',
        maxAccuracy: '10.0',
        minSpeed: '0.0',
        maxSpeed: '50.0',
        startTime: '2023-01-01T00:00:00Z',
        endTime: '2023-12-31T23:59:59Z',
        page: '1',
        limit: '100',
        sortBy: 'timestamp',
        sortOrder: 'desc' as const,
      };
      
      const start = process.hrtime.bigint();
      
      for (let i = 0; i < 1000; i++) {
        parseEquipmentQuery(complexQuery);
        parsePositionQuery(complexQuery);
        parsePaginationQuery(complexQuery);
      }
      
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds
      
      // Should complete 1000 iterations of complex parsing in reasonable time
      expect(duration).toBeLessThan(1000); // Under 1 second
    });
  });
});
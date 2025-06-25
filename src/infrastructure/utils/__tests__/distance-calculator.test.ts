// <test_code>
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  calculateHaversineDistance,
  calculateBearing,
  distanceBetweenPositions,
  isPointInCircle,
  isPointInBounds,
  convertDistance,
  formatDistance
} from '../../src/infrastructure/utils/distance';

// Mock the Constants from types
jest.mock('../../types/index.js', () => ({
  Constants: {
    EARTH_RADIUS_METERS: 6371000
  }
}));

describe('Distance Utilities', () => {
  describe('calculateHaversineDistance', () => {
    it('should calculate distance between two identical points as 0', () => {
      const lat = 40.7128;
      const lng = -74.0060;
      
      const distance = calculateHaversineDistance(lat, lng, lat, lng);
      
      expect(distance).toBeCloseTo(0, 5);
    });
    
    it('should calculate distance between New York and Los Angeles', () => {
      // New York
      const lat1 = 40.7128;
      const lng1 = -74.0060;
      
      // Los Angeles
      const lat2 = 34.0522;
      const lng2 = -118.2437;
      
      // Expected distance is approximately 3935km or 3935000m
      const distance = calculateHaversineDistance(lat1, lng1, lat2, lng2);
      
      expect(distance).toBeCloseTo(3935000, -3); // Less precision for long distances
    });
    
    it('should calculate distance between London and Paris', () => {
      // London
      const lat1 = 51.5074;
      const lng1 = -0.1278;
      
      // Paris
      const lat2 = 48.8566;
      const lng2 = 2.3522;
      
      // Expected distance is approximately 334km or 334000m
      const distance = calculateHaversineDistance(lat1, lng1, lat2, lng2);
      
      expect(distance).toBeCloseTo(334000, -3);
    });
  });
  
  describe('calculateBearing', () => {
    it('should calculate bearing between two identical points', () => {
      const lat = 40.7128;
      const lng = -74.0060;
      
      const bearing = calculateBearing(lat, lng, lat, lng);
      
      // When points are identical, bearing is not well-defined
      // but our function should return a number between 0-360
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThanOrEqual(360);
    });
    
    it('should calculate bearing from New York to Los Angeles', () => {
      // New York
      const lat1 = 40.7128;
      const lng1 = -74.0060;
      
      // Los Angeles
      const lat2 = 34.0522;
      const lng2 = -118.2437;
      
      // Expected bearing is approximately 280 degrees
      const bearing = calculateBearing(lat1, lng1, lat2, lng2);
      
      expect(bearing).toBeCloseTo(280, 0);
    });
    
    it('should calculate bearing from London to Paris', () => {
      // London
      const lat1 = 51.5074;
      const lng1 = -0.1278;
      
      // Paris
      const lat2 = 48.8566;
      const lng2 = 2.3522;
      
      // Expected bearing is approximately 132 degrees
      const bearing = calculateBearing(lat1, lng1, lat2, lng2);
      
      expect(bearing).toBeCloseTo(132, 0);
    });
    
    it('should normalize bearing to 0-360 degrees', () => {
      // Test case that would produce a negative bearing before normalization
      const lat1 = 0;
      const lng1 = 0;
      const lat2 = -10;
      const lng2 = -10;
      
      const bearing = calculateBearing(lat1, lng1, lat2, lng2);
      
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThanOrEqual(360);
    });
  });
  
  describe('distanceBetweenPositions', () => {
    it('should calculate distance between two position objects', () => {
      const pos1 = { latitude: 40.7128, longitude: -74.0060 };
      const pos2 = { latitude: 34.0522, longitude: -118.2437 };
      
      const distance = distanceBetweenPositions(pos1, pos2);
      
      // Should match the result from calculateHaversineDistance
      const expectedDistance = calculateHaversineDistance(
        pos1.latitude, pos1.longitude, pos2.latitude, pos2.longitude
      );
      
      expect(distance).toBe(expectedDistance);
    });
  });
  
  describe('isPointInCircle', () => {
    it('should return true when point is at the center of circle', () => {
      const centerLat = 40.7128;
      const centerLng = -74.0060;
      const pointLat = centerLat;
      const pointLng = centerLng;
      const radius = 1000; // 1km radius
      
      const result = isPointInCircle(pointLat, pointLng, centerLat, centerLng, radius);
      
      expect(result).toBe(true);
    });
    
    it('should return true when point is within the circle', () => {
      const centerLat = 40.7128;
      const centerLng = -74.0060;
      // Point that's about 500m away from center
      const pointLat = 40.7173;
      const pointLng = -74.0060;
      const radius = 1000; // 1km radius
      
      const result = isPointInCircle(pointLat, pointLng, centerLat, centerLng, radius);
      
      expect(result).toBe(true);
    });
    
    it('should return false when point is outside the circle', () => {
      const centerLat = 40.7128;
      const centerLng = -74.0060;
      // Point that's about 2km away from center
      const pointLat = 40.7309;
      const pointLng = -74.0060;
      const radius = 1000; // 1km radius
      
      const result = isPointInCircle(pointLat, pointLng, centerLat, centerLng, radius);
      
      expect(result).toBe(false);
    });
    
    it('should return true when point is exactly on the circle boundary', () => {
      const centerLat = 40.7128;
      const centerLng = -74.0060;
      // Create a point exactly at the radius distance
      const radius = 1000; // 1km
      
      // We'll use a spy to ensure the distance calculation returns exactly the radius
      const spy = jest.spyOn(global.Math, 'atan2').mockImplementationOnce(() => {
        return Math.asin(radius / (2 * 6371000)) * 2;
      });
      
      const result = isPointInCircle(40.7218, -74.0060, centerLat, centerLng, radius);
      
      expect(result).toBe(true);
      spy.mockRestore();
    });
  });
  
  describe('isPointInBounds', () => {
    it('should return true when point is inside the bounds', () => {
      const pointLat = 40.7128;
      const pointLng = -74.0060;
      const northEastLat = 41.0;
      const northEastLng = -73.0;
      const southWestLat = 40.0;
      const southWestLng = -75.0;
      
      const result = isPointInBounds(
        pointLat, pointLng, northEastLat, northEastLng, southWestLat, southWestLng
      );
      
      expect(result).toBe(true);
    });
    
    it('should return false when point is outside the bounds (north)', () => {
      const pointLat = 42.0;
      const pointLng = -74.0060;
      const northEastLat = 41.0;
      const northEastLng = -73.0;
      const southWestLat = 40.0;
      const southWestLng = -75.0;
      
      const result = isPointInBounds(
        pointLat, pointLng, northEastLat, northEastLng, southWestLat, southWestLng
      );
      
      expect(result).toBe(false);
    });
    
    it('should return false when point is outside the bounds (east)', () => {
      const pointLat = 40.5;
      const pointLng = -72.0;
      const northEastLat = 41.0;
      const northEastLng = -73.0;
      const southWestLat = 40.0;
      const southWestLng = -75.0;
      
      const result = isPointInBounds(
        pointLat, pointLng, northEastLat, northEastLng, southWestLat, southWestLng
      );
      
      expect(result).toBe(false);
    });
    
    it('should return false when point is outside the bounds (south)', () => {
      const pointLat = 39.5;
      const pointLng = -74.0060;
      const northEastLat = 41.0;
      const northEastLng = -73.0;
      const southWestLat = 40.0;
      const southWestLng = -75.0;
      
      const result = isPointInBounds(
        pointLat, pointLng, northEastLat, northEastLng, southWestLat, southWestLng
      );
      
      expect(result).toBe(false);
    });
    
    it('should return false when point is outside the bounds (west)', () => {
      const pointLat = 40.5;
      const pointLng = -76.0;
      const northEastLat = 41.0;
      const northEastLng = -73.0;
      const southWestLat = 40.0;
      const southWestLng = -75.0;
      
      const result = isPointInBounds(
        pointLat, pointLng, northEastLat, northEastLng, southWestLat, southWestLng
      );
      
      expect(result).toBe(false);
    });
    
    it('should return true when point is exactly on the boundary', () => {
      const pointLat = 40.0; // On the south boundary
      const pointLng = -74.0; // Inside east-west bounds
      const northEastLat = 41.0;
      const northEastLng = -73.0;
      const southWestLat = 40.0;
      const southWestLng = -75.0;
      
      const result = isPointInBounds(
        pointLat, pointLng, northEastLat, northEastLng, southWestLat, southWestLng
      );
      
      expect(result).toBe(true);
    });
  });
  
  describe('convertDistance', () => {
    it('should convert meters to kilometers', () => {
      const meters = 5000;
      const kilometers = convertDistance.toKilometers(meters);
      
      expect(kilometers).toBe(5);
    });
    
    it('should convert meters to miles', () => {
      const meters = 1609.344;
      const miles = convertDistance.toMiles(meters);
      
      expect(miles).toBeCloseTo(1, 5);
    });
    
    it('should convert meters to feet', () => {
      const meters = 1;
      const feet = convertDistance.toFeet(meters);
      
      expect(feet).toBeCloseTo(3.28084, 5);
    });
    
    it('should convert meters to nautical miles', () => {
      const meters = 1852;
      const nauticalMiles = convertDistance.toNauticalMiles(meters);
      
      expect(nauticalMiles).toBeCloseTo(1, 5);
    });
    
    it('should handle zero values', () => {
      expect(convertDistance.toKilometers(0)).toBe(0);
      expect(convertDistance.toMiles(0)).toBe(0);
      expect(convertDistance.toFeet(0)).toBe(0);
      expect(convertDistance.toNauticalMiles(0)).toBe(0);
    });
  });
  
  describe('formatDistance', () => {
    it('should format distances less than 1km in meters', () => {
      expect(formatDistance(500)).toBe('500.0m');
      expect(formatDistance(0)).toBe('0.0m');
      expect(formatDistance(999.9)).toBe('999.9m');
    });
    
    it('should format distances between 1km and 10km with 2 decimal places', () => {
      expect(formatDistance(1000)).toBe('1.00km');
      expect(formatDistance(1500)).toBe('1.50km');
      expect(formatDistance(9999)).toBe('10.00km');
    });
    
    it('should format distances 10km or greater with 1 decimal place', () => {
      expect(formatDistance(10000)).toBe('10.0km');
      expect(formatDistance(15500)).toBe('15.5km');
      expect(formatDistance(100000)).toBe('100.0km');
    });
  });
});
// </test_code>
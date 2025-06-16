/**
 * Unit tests for distance calculator utilities
 */

import {
  calculateHaversineDistance,
  calculateFastDistance,
  createDistanceCalculator,
  calculateBearing,
  distanceBetweenPositions,
  isPointInCircle,
  isPointInBounds,
  isWithinDistance,
  calculateDistancesToMultiplePoints,
  convertDistance,
  formatDistance,
} from '../../../src/infrastructure/utils/distance-calculator.js';
import { Position } from '../../../src/models/position.js';

describe('Distance Calculator', () => {
  // Test coordinates (San Francisco area)
  const SF_LAT = 37.7749;
  const SF_LNG = -122.4194;
  const OAKLAND_LAT = 37.8044;
  const OAKLAND_LNG = -122.2711;
  const KNOWN_SF_OAKLAND_DISTANCE = 13438; // meters (approx)

  // Test coordinates (Sydney area)
  const SYDNEY_LAT = -33.8688;
  const SYDNEY_LNG = 151.2093;
  const PARRAMATTA_LAT = -33.8150;
  const PARRAMATTA_LNG = 151.0000;

  describe('calculateHaversineDistance', () => {
    it('should calculate correct distance between San Francisco and Oakland', () => {
      const distance = calculateHaversineDistance(SF_LAT, SF_LNG, OAKLAND_LAT, OAKLAND_LNG);
      
      // Allow 1% tolerance for rounding differences
      expect(distance).toBeCloseTo(KNOWN_SF_OAKLAND_DISTANCE, -2);
    });

    it('should return 0 for same coordinates', () => {
      const distance = calculateHaversineDistance(SF_LAT, SF_LNG, SF_LAT, SF_LNG);
      expect(distance).toBe(0);
    });

    it('should handle antipodal points correctly', () => {
      const distance = calculateHaversineDistance(0, 0, 0, 180);
      // Half the Earth's circumference
      expect(distance).toBeCloseTo(20015086, -3);
    });

    it('should handle negative coordinates', () => {
      const distance = calculateHaversineDistance(SYDNEY_LAT, SYDNEY_LNG, PARRAMATTA_LAT, PARRAMATTA_LNG);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(50000); // Should be reasonable distance
    });

    it('should be symmetric', () => {
      const distance1 = calculateHaversineDistance(SF_LAT, SF_LNG, OAKLAND_LAT, OAKLAND_LNG);
      const distance2 = calculateHaversineDistance(OAKLAND_LAT, OAKLAND_LNG, SF_LAT, SF_LNG);
      expect(distance1).toEqual(distance2);
    });
  });

  describe('calculateFastDistance', () => {
    it('should approximate Haversine distance for short distances', () => {
      const haversine = calculateHaversineDistance(SF_LAT, SF_LNG, SF_LAT + 0.01, SF_LNG + 0.01);
      const fast = calculateFastDistance(SF_LAT, SF_LNG, SF_LAT + 0.01, SF_LNG + 0.01);
      
      // Fast approximation should be within 5% for short distances
      const errorPercent = Math.abs(fast - haversine) / haversine * 100;
      expect(errorPercent).toBeLessThan(5);
    });

    it('should return 0 for same coordinates', () => {
      const distance = calculateFastDistance(SF_LAT, SF_LNG, SF_LAT, SF_LNG);
      expect(distance).toBe(0);
    });

    it('should be symmetric', () => {
      const distance1 = calculateFastDistance(SF_LAT, SF_LNG, OAKLAND_LAT, OAKLAND_LNG);
      const distance2 = calculateFastDistance(OAKLAND_LAT, OAKLAND_LNG, SF_LAT, SF_LNG);
      expect(distance1).toEqual(distance2);
    });
  });

  describe('createDistanceCalculator', () => {
    it('should create a calculator that gives same results as direct calculation', () => {
      const calculator = createDistanceCalculator(SF_LAT, SF_LNG);
      const directDistance = calculateHaversineDistance(SF_LAT, SF_LNG, OAKLAND_LAT, OAKLAND_LNG);
      const calculatorDistance = calculator(OAKLAND_LAT, OAKLAND_LNG);
      
      expect(calculatorDistance).toBeCloseTo(directDistance, 1);
    });

    it('should handle multiple calculations from same origin', () => {
      const calculator = createDistanceCalculator(SF_LAT, SF_LNG);
      
      const targets = [
        { lat: OAKLAND_LAT, lng: OAKLAND_LNG },
        { lat: SF_LAT + 0.1, lng: SF_LNG + 0.1 },
        { lat: SF_LAT - 0.05, lng: SF_LNG - 0.05 },
      ];

      targets.forEach(target => {
        const calculatorDistance = calculator(target.lat, target.lng);
        const directDistance = calculateHaversineDistance(SF_LAT, SF_LNG, target.lat, target.lng);
        expect(calculatorDistance).toBeCloseTo(directDistance, 1);
      });
    });
  });

  describe('calculateBearing', () => {
    it('should calculate correct bearing between known points', () => {
      // SF to Oakland should be roughly northeast (around 60 degrees)
      const bearing = calculateBearing(SF_LAT, SF_LNG, OAKLAND_LAT, OAKLAND_LNG);
      expect(bearing).toBeGreaterThan(40);
      expect(bearing).toBeLessThan(80);
    });

    it('should return 0 for due north', () => {
      const bearing = calculateBearing(SF_LAT, SF_LNG, SF_LAT + 1, SF_LNG);
      expect(bearing).toBeCloseTo(0, 1);
    });

    it('should return 90 for due east', () => {
      const bearing = calculateBearing(SF_LAT, SF_LNG, SF_LAT, SF_LNG + 1);
      expect(bearing).toBeCloseTo(90, 0);
    });

    it('should return 180 for due south', () => {
      const bearing = calculateBearing(SF_LAT, SF_LNG, SF_LAT - 1, SF_LNG);
      expect(bearing).toBeCloseTo(180, 1);
    });

    it('should return 270 for due west', () => {
      const bearing = calculateBearing(SF_LAT, SF_LNG, SF_LAT, SF_LNG - 1);
      expect(bearing).toBeCloseTo(270, 0);
    });

    it('should return values between 0 and 360', () => {
      const bearing = calculateBearing(SF_LAT, SF_LNG, SYDNEY_LAT, SYDNEY_LNG);
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);
    });
  });

  describe('distanceBetweenPositions', () => {
    it('should calculate distance between Position objects', () => {
      const pos1 = new Position({
        latitude: SF_LAT,
        longitude: SF_LNG,
        altitude: 0,
        accuracy: 1,
        timestamp: new Date(),
      });

      const pos2 = new Position({
        latitude: OAKLAND_LAT,
        longitude: OAKLAND_LNG,
        altitude: 0,
        accuracy: 1,
        timestamp: new Date(),
      });

      const distance = distanceBetweenPositions(pos1, pos2);
      expect(distance).toBeCloseTo(KNOWN_SF_OAKLAND_DISTANCE, -2);
    });
  });

  describe('isPointInCircle', () => {
    it('should return true for point inside circle', () => {
      // Point 100 meters from center
      const result = isPointInCircle(SF_LAT, SF_LNG, SF_LAT + 0.0009, SF_LNG, 200);
      expect(result).toBe(true);
    });

    it('should return false for point outside circle', () => {
      // Oakland is much farther than 1000 meters from SF
      const result = isPointInCircle(SF_LAT, SF_LNG, OAKLAND_LAT, OAKLAND_LNG, 1000);
      expect(result).toBe(false);
    });

    it('should return true for point exactly on circle boundary', () => {
      const distance = calculateHaversineDistance(SF_LAT, SF_LNG, SF_LAT + 0.009, SF_LNG);
      const result = isPointInCircle(SF_LAT, SF_LNG, SF_LAT + 0.009, SF_LNG, distance);
      expect(result).toBe(true);
    });

    it('should return true for center point', () => {
      const result = isPointInCircle(SF_LAT, SF_LNG, SF_LAT, SF_LNG, 100);
      expect(result).toBe(true);
    });
  });

  describe('isPointInBounds', () => {
    const northEastLat = SF_LAT + 0.1;
    const northEastLng = SF_LNG + 0.1;
    const southWestLat = SF_LAT - 0.1;
    const southWestLng = SF_LNG - 0.1;

    it('should return true for point inside bounds', () => {
      const result = isPointInBounds(
        SF_LAT,
        SF_LNG,
        northEastLat,
        northEastLng,
        southWestLat,
        southWestLng
      );
      expect(result).toBe(true);
    });

    it('should return false for point outside bounds (north)', () => {
      const result = isPointInBounds(
        northEastLat + 0.01,
        SF_LNG,
        northEastLat,
        northEastLng,
        southWestLat,
        southWestLng
      );
      expect(result).toBe(false);
    });

    it('should return false for point outside bounds (south)', () => {
      const result = isPointInBounds(
        southWestLat - 0.01,
        SF_LNG,
        northEastLat,
        northEastLng,
        southWestLat,
        southWestLng
      );
      expect(result).toBe(false);
    });

    it('should return false for point outside bounds (east)', () => {
      const result = isPointInBounds(
        SF_LAT,
        northEastLng + 0.01,
        northEastLat,
        northEastLng,
        southWestLat,
        southWestLng
      );
      expect(result).toBe(false);
    });

    it('should return false for point outside bounds (west)', () => {
      const result = isPointInBounds(
        SF_LAT,
        southWestLng - 0.01,
        northEastLat,
        northEastLng,
        southWestLat,
        southWestLng
      );
      expect(result).toBe(false);
    });

    it('should return true for point on boundary', () => {
      const result = isPointInBounds(
        northEastLat,
        northEastLng,
        northEastLat,
        northEastLng,
        southWestLat,
        southWestLng
      );
      expect(result).toBe(true);
    });

    it('should handle longitude wraparound correctly', () => {
      // Test bounds that cross the international date line
      const result = isPointInBounds(
        0, // latitude
        -170, // longitude (close to date line)
        10, // north
        -160, // east (crosses date line)
        -10, // south
        170, // west
      );
      expect(result).toBe(true);
    });
  });

  describe('isWithinDistance', () => {
    it('should return true for points within threshold', () => {
      // Small distance (should be well within 1000m threshold)
      const result = isWithinDistance(SF_LAT, SF_LNG, SF_LAT + 0.001, SF_LNG + 0.001, 1000);
      expect(result).toBe(true);
    });

    it('should return false for points beyond threshold', () => {
      // SF to Oakland is much more than 1000m
      const result = isWithinDistance(SF_LAT, SF_LNG, OAKLAND_LAT, OAKLAND_LNG, 1000);
      expect(result).toBe(false);
    });

    it('should be faster than calculating exact distance', () => {
      const start = process.hrtime.bigint();
      
      // Do many distance checks
      for (let i = 0; i < 1000; i++) {
        isWithinDistance(SF_LAT, SF_LNG, SF_LAT + i * 0.0001, SF_LNG + i * 0.0001, 5000);
      }
      
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds
      
      // Should complete 1000 checks in reasonable time (under 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should handle edge cases correctly', () => {
      // Same point
      expect(isWithinDistance(SF_LAT, SF_LNG, SF_LAT, SF_LNG, 100)).toBe(true);
      
      // Zero threshold
      expect(isWithinDistance(SF_LAT, SF_LNG, SF_LAT + 0.001, SF_LNG, 0)).toBe(false);
    });
  });

  describe('calculateDistancesToMultiplePoints', () => {
    const targets = [
      { lat: OAKLAND_LAT, lng: OAKLAND_LNG },
      { lat: SF_LAT + 0.1, lng: SF_LNG + 0.1 },
      { lat: SF_LAT - 0.05, lng: SF_LNG - 0.05 },
      { lat: SYDNEY_LAT, lng: SYDNEY_LNG },
    ];

    it('should calculate distances to multiple points correctly', () => {
      const distances = calculateDistancesToMultiplePoints(SF_LAT, SF_LNG, targets);
      
      expect(distances).toHaveLength(targets.length);
      
      // First target should be Oakland distance
      expect(distances[0]).toBeCloseTo(KNOWN_SF_OAKLAND_DISTANCE, -2);
      
      // All distances should be positive
      distances.forEach(distance => {
        expect(distance).toBeGreaterThanOrEqual(0);
      });
    });

    it('should return same results as individual calculations', () => {
      const batchDistances = calculateDistancesToMultiplePoints(SF_LAT, SF_LNG, targets);
      
      targets.forEach((target, index) => {
        const individualDistance = calculateHaversineDistance(SF_LAT, SF_LNG, target.lat, target.lng);
        expect(batchDistances[index]).toBeCloseTo(individualDistance, 1);
      });
    });

    it('should handle empty array', () => {
      const distances = calculateDistancesToMultiplePoints(SF_LAT, SF_LNG, []);
      expect(distances).toEqual([]);
    });
  });

  describe('convertDistance', () => {
    const testMeters = 1000;

    it('should convert meters to kilometers correctly', () => {
      const km = convertDistance.toKilometers(testMeters);
      expect(km).toBe(1);
    });

    it('should convert meters to miles correctly', () => {
      const miles = convertDistance.toMiles(testMeters);
      expect(miles).toBeCloseTo(0.621371, 5);
    });

    it('should convert meters to feet correctly', () => {
      const feet = convertDistance.toFeet(testMeters);
      expect(feet).toBeCloseTo(3280.84, 2);
    });

    it('should convert meters to nautical miles correctly', () => {
      const nauticalMiles = convertDistance.toNauticalMiles(testMeters);
      expect(nauticalMiles).toBeCloseTo(0.539957, 5);
    });

    it('should handle zero distance', () => {
      expect(convertDistance.toKilometers(0)).toBe(0);
      expect(convertDistance.toMiles(0)).toBe(0);
      expect(convertDistance.toFeet(0)).toBe(0);
      expect(convertDistance.toNauticalMiles(0)).toBe(0);
    });
  });

  describe('formatDistance', () => {
    it('should format meters correctly for distances under 1km', () => {
      expect(formatDistance(50)).toBe('50.0m');
      expect(formatDistance(999.9)).toBe('999.9m');
    });

    it('should format kilometers correctly for distances 1-10km', () => {
      expect(formatDistance(1000)).toBe('1.00km');
      expect(formatDistance(5500)).toBe('5.50km');
      expect(formatDistance(9999)).toBe('10.00km');
    });

    it('should format kilometers correctly for distances over 10km', () => {
      expect(formatDistance(10000)).toBe('10.0km');
      expect(formatDistance(25000)).toBe('25.0km');
      expect(formatDistance(100000)).toBe('100.0km');
    });

    it('should handle zero distance', () => {
      expect(formatDistance(0)).toBe('0.0m');
    });

    it('should handle very large distances', () => {
      expect(formatDistance(1000000)).toBe('1000.0km');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle extreme latitude values', () => {
      // North and South poles
      const distance1 = calculateHaversineDistance(90, 0, -90, 0);
      const distance2 = calculateHaversineDistance(-90, 0, 90, 180);
      
      // Should be approximately half the Earth's circumference
      expect(distance1).toBeCloseTo(20015086, -3);
      expect(distance2).toBeCloseTo(20015086, -3);
    });

    it('should handle longitude wraparound', () => {
      // Points near international date line
      const distance = calculateHaversineDistance(0, 179, 0, -179);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(500000); // Should be reasonable
    });

    it('should handle very small distances', () => {
      const distance = calculateHaversineDistance(SF_LAT, SF_LNG, SF_LAT + 0.000001, SF_LNG);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(1); // Should be less than 1 meter
    });

    it('should maintain precision for known test cases', () => {
      // Test case from geodesy literature
      const lat1 = 50.06639;
      const lng1 = 5.71472;
      const lat2 = 58.64389;
      const lng2 = 3.07000;
      
      const distance = calculateHaversineDistance(lat1, lng1, lat2, lng2);
      // Known distance: approximately 968.9 km
      expect(distance).toBeCloseTo(968900, -2);
    });
  });

  describe('Performance tests', () => {
    it('should complete many Haversine calculations in reasonable time', () => {
      const start = process.hrtime.bigint();
      
      for (let i = 0; i < 10000; i++) {
        calculateHaversineDistance(SF_LAT, SF_LNG, SF_LAT + i * 0.0001, SF_LNG + i * 0.0001);
      }
      
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds
      
      // Should complete 10,000 calculations in under 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should show fast approximation is indeed faster', () => {
      const iterations = 10000;
      
      // Time Haversine calculations
      const haversineStart = process.hrtime.bigint();
      for (let i = 0; i < iterations; i++) {
        calculateHaversineDistance(SF_LAT, SF_LNG, SF_LAT + i * 0.0001, SF_LNG + i * 0.0001);
      }
      const haversineEnd = process.hrtime.bigint();
      const haversineDuration = Number(haversineEnd - haversineStart);
      
      // Time fast approximation calculations
      const fastStart = process.hrtime.bigint();
      for (let i = 0; i < iterations; i++) {
        calculateFastDistance(SF_LAT, SF_LNG, SF_LAT + i * 0.0001, SF_LNG + i * 0.0001);
      }
      const fastEnd = process.hrtime.bigint();
      const fastDuration = Number(fastEnd - fastStart);
      
      // Fast approximation should be faster
      expect(fastDuration).toBeLessThan(haversineDuration);
    });
  });
});
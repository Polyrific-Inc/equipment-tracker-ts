/**
 * Distance calculation utilities
 */

import { Constants, Position, Distance, Latitude, Longitude } from '../../types/index.js';

// Mathematical constants for optimization
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Calculate distance between two points using Haversine formula
 */
export const calculateHaversineDistance = (
  lat1: Latitude,
  lng1: Longitude,
  lat2: Latitude,
  lng2: Longitude,
): Distance => {
  const R = Constants.EARTH_RADIUS_METERS;

  // Convert degrees to radians
  const lat1Rad = lat1 * DEG_TO_RAD;
  const lat2Rad = lat2 * DEG_TO_RAD;
  const deltaLatRad = (lat2 - lat1) * DEG_TO_RAD;
  const deltaLonRad = (lng2 - lng1) * DEG_TO_RAD;

  // Haversine formula
  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Calculate bearing between two points
 */
export const calculateBearing = (
  lat1: Latitude,
  lng1: Longitude,
  lat2: Latitude,
  lng2: Longitude,
): number => {
  const lat1Rad = lat1 * DEG_TO_RAD;
  const lat2Rad = lat2 * DEG_TO_RAD;
  const deltaLonRad = (lng2 - lng1) * DEG_TO_RAD;

  const y = Math.sin(deltaLonRad) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLonRad);

  const bearing = Math.atan2(y, x) * RAD_TO_DEG;

  // Normalize to 0-360 degrees
  return (bearing + 360) % 360;
};

/**
 * Fast approximation for distance calculation using equirectangular projection
 * Good for short distances (< 10km) where performance is more important than precision
 * About 10x faster than Haversine but less accurate over long distances
 */
export const calculateFastDistance = (
  lat1: Latitude,
  lng1: Longitude,
  lat2: Latitude,
  lng2: Longitude,
): Distance => {
  const R = Constants.EARTH_RADIUS_METERS;
  const lat1Rad = lat1 * DEG_TO_RAD;
  const lat2Rad = lat2 * DEG_TO_RAD;
  const deltaLatRad = (lat2 - lat1) * DEG_TO_RAD;
  const deltaLonRad = (lng2 - lng1) * DEG_TO_RAD;

  const x = deltaLonRad * Math.cos((lat1Rad + lat2Rad) / 2);
  const y = deltaLatRad;

  return R * Math.sqrt(x * x + y * y);
};

/**
 * Optimized Haversine distance with pre-computed sin/cos values
 * Use when calculating multiple distances from the same point
 */
export const createDistanceCalculator = (baseLat: Latitude, baseLng: Longitude) => {
  const baseLatRad = baseLat * DEG_TO_RAD;
  const cosBaseLat = Math.cos(baseLatRad);

  return (targetLat: Latitude, targetLng: Longitude): Distance => {
    const R = Constants.EARTH_RADIUS_METERS;
    const targetLatRad = targetLat * DEG_TO_RAD;
    const deltaLatRad = (targetLat - baseLat) * DEG_TO_RAD;
    const deltaLonRad = (targetLng - baseLng) * DEG_TO_RAD;

    const cosTargetLat = Math.cos(targetLatRad);
    const sinDeltaLatHalf = Math.sin(deltaLatRad / 2);
    const sinDeltaLonHalf = Math.sin(deltaLonRad / 2);

    const a =
      sinDeltaLatHalf * sinDeltaLatHalf +
      cosBaseLat * cosTargetLat * sinDeltaLonHalf * sinDeltaLonHalf;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
};

/**
 * Calculate distance between two Position objects
 */
export const distanceBetweenPositions = (pos1: Position, pos2: Position): Distance => {
  return calculateHaversineDistance(pos1.latitude, pos1.longitude, pos2.latitude, pos2.longitude);
};

/**
 * Check if a point is within a circular area
 */
export const isPointInCircle = (
  pointLat: Latitude,
  pointLng: Longitude,
  centerLat: Latitude,
  centerLng: Longitude,
  radiusMeters: Distance,
): boolean => {
  const distance = calculateHaversineDistance(pointLat, pointLng, centerLat, centerLng);
  return distance <= radiusMeters;
};

/**
 * Check if a point is within a rectangular bounds
 * Optimized version with early exit and longitude wraparound handling
 */
export const isPointInBounds = (
  pointLat: Latitude,
  pointLng: Longitude,
  northEastLat: Latitude,
  northEastLng: Longitude,
  southWestLat: Latitude,
  southWestLng: Longitude,
): boolean => {
  // Early exit for latitude (most restrictive check first)
  if (pointLat < southWestLat || pointLat > northEastLat) {
    return false;
  }

  // Handle longitude wraparound (crossing 180/-180 meridian)
  if (southWestLng <= northEastLng) {
    // Normal case: bounds don't cross meridian
    return pointLng >= southWestLng && pointLng <= northEastLng;
  } else {
    // Bounds cross meridian: point must be in either range
    return pointLng >= southWestLng || pointLng <= northEastLng;
  }
};

/**
 * Convert meters to other units
 */
export const convertDistance = {
  toKilometers: (meters: Distance): number => meters / 1000,
  toMiles: (meters: Distance): number => meters / 1609.344,
  toFeet: (meters: Distance): number => meters * 3.28084,
  toNauticalMiles: (meters: Distance): number => meters / 1852,
};

/**
 * Fast distance check without calculating exact distance
 * Returns true if distance is within threshold, about 5x faster than full calculation
 */
export const isWithinDistance = (
  lat1: Latitude,
  lng1: Longitude,
  lat2: Latitude,
  lng2: Longitude,
  thresholdMeters: Distance,
): boolean => {
  // Quick bounding box check first (very fast)
  const R = Constants.EARTH_RADIUS_METERS;
  const latThreshold = (thresholdMeters / R) * RAD_TO_DEG;
  const lngThreshold = latThreshold / Math.cos(lat1 * DEG_TO_RAD);

  if (
    Math.abs(lat2 - lat1) > latThreshold ||
    Math.abs(lng2 - lng1) > lngThreshold
  ) {
    return false;
  }

  // If within bounding box, do fast distance calculation
  const distance = calculateFastDistance(lat1, lng1, lat2, lng2);
  return distance <= thresholdMeters;
};

/**
 * Batch distance calculations from a single point to multiple targets
 * More efficient when calculating distances to many points from one origin
 */
export const calculateDistancesToMultiplePoints = (
  originLat: Latitude,
  originLng: Longitude,
  targets: Array<{ lat: Latitude; lng: Longitude }>,
): Distance[] => {
  const calculator = createDistanceCalculator(originLat, originLng);
  return targets.map(target => calculator(target.lat, target.lng));
};

/**
 * Format distance for display
 */
export const formatDistance = (meters: Distance): string => {
  if (meters < 1000) {
    return `${meters.toFixed(1)}m`;
  } else if (meters < 10000) {
    return `${(meters / 1000).toFixed(2)}km`;
  } else {
    return `${(meters / 1000).toFixed(1)}km`;
  }
};

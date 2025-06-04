/**
 * Distance calculation utilities
 */

import { Constants, Position, Distance, Latitude, Longitude } from '../../types/index.js';
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
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const deltaLatRad = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLonRad = ((lng2 - lng1) * Math.PI) / 180;

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
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const deltaLonRad = ((lng2 - lng1) * Math.PI) / 180;

  const y = Math.sin(deltaLonRad) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLonRad);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;

  // Normalize to 0-360 degrees
  return (bearing + 360) % 360;
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
 */
export const isPointInBounds = (
  pointLat: Latitude,
  pointLng: Longitude,
  northEastLat: Latitude,
  northEastLng: Longitude,
  southWestLat: Latitude,
  southWestLng: Longitude,
): boolean => {
  return (
    pointLat >= southWestLat &&
    pointLat <= northEastLat &&
    pointLng >= southWestLng &&
    pointLng <= northEastLng
  );
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

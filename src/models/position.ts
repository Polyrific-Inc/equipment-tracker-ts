/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable complexity */
/**
 * Position domain model - represents a geographic position with GPS data
 */

import {
  Position as IPosition,
  CreatePositionData,
  DistanceCalculation,
  PositionValidationResult,
  Latitude,
  Longitude,
  Altitude,
  Accuracy,
  Timestamp,
  Distance,
  Constants,
  isValidLatitude,
  isValidLongitude,
  isValidTimestamp,
} from '../types/index.js';

export class Position implements IPosition {
  readonly latitude: Latitude;
  readonly longitude: Longitude;
  readonly altitude: Altitude;
  readonly accuracy: Accuracy;
  readonly timestamp: Timestamp;

  constructor(data: CreatePositionData) {
    // Validate input data
    const validation = Position.validate(data);
    if (!validation.isValid) {
      throw new Error(`Invalid position data: ${validation.errors.join(', ')}`);
    }

    this.latitude = data.latitude;
    this.longitude = data.longitude;
    this.altitude = data.altitude ?? 0.0;
    this.accuracy = data.accuracy ?? Constants.DEFAULT_POSITION_ACCURACY;
    this.timestamp = data.timestamp ?? new Date();
  }

  /**
   * Create a Position using the builder pattern
   */
  static builder(): PositionBuilder {
    return new PositionBuilder();
  }

  /**
   * Create a Position from an existing Position interface
   */
  static fromInterface(position: IPosition): Position {
    return new Position({
      latitude: position.latitude,
      longitude: position.longitude,
      altitude: position.altitude,
      accuracy: position.accuracy,
      timestamp: position.timestamp,
    });
  }

  /**
   * Validate position data
   */
  static validate(data: CreatePositionData): PositionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate latitude
    if (!isValidLatitude(data.latitude)) {
      errors.push('Latitude must be a number between -90 and 90 degrees');
    }

    // Validate longitude
    if (!isValidLongitude(data.longitude)) {
      errors.push('Longitude must be a number between -180 and 180 degrees');
    }

    // Validate altitude (optional but if provided, should be reasonable)
    if (data.altitude !== undefined) {
      if (typeof data.altitude !== 'number' || Number.isNaN(data.altitude)) {
        errors.push('Altitude must be a valid number');
      } else if (data.altitude < -500 || data.altitude > 20000) {
        warnings.push('Altitude seems unusual (expected range: -500m to 20,000m)');
      }
    }

    // Validate accuracy (optional but if provided, should be positive)
    if (data.accuracy !== undefined) {
      if (typeof data.accuracy !== 'number' || Number.isNaN(data.accuracy) || data.accuracy < 0) {
        errors.push('Accuracy must be a positive number');
      } else if (data.accuracy > 1000) {
        warnings.push('Accuracy seems very low (>1000m)');
      }
    }

    // Validate timestamp (optional but if provided, should be valid)
    if (data.timestamp !== undefined && !isValidTimestamp(data.timestamp)) {
      errors.push('Timestamp must be a valid Date object');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Calculate distance to another position using Haversine formula
   */
  distanceTo(other: Position | IPosition): Distance {
    return Position.calculateDistance(this, other).distance;
  }

  /**
   * Calculate distance and bearing to another position
   */
  static calculateDistance(
    pos1: Position | IPosition,
    pos2: Position | IPosition,
    method: 'haversine' | 'vincenty' | 'euclidean' = 'haversine',
  ): DistanceCalculation {
    switch (method) {
      case 'haversine':
        return Position.calculateHaversineDistance(pos1, pos2);
      case 'euclidean':
        return Position.calculateEuclideanDistance(pos1, pos2);
      case 'vincenty':
        // For now, fall back to Haversine (Vincenty is more complex to implement)
        return Position.calculateHaversineDistance(pos1, pos2);
      default:
        throw new Error(`Unknown distance calculation method: ${method}`);
    }
  }

  /**
   * Calculate distance using Haversine formula (great-circle distance)
   */
  private static calculateHaversineDistance(
    pos1: Position | IPosition,
    pos2: Position | IPosition,
  ): DistanceCalculation {
    const R = Constants.EARTH_RADIUS_METERS;

    // Convert degrees to radians
    const lat1Rad = (pos1.latitude * Math.PI) / 180;
    const lat2Rad = (pos2.latitude * Math.PI) / 180;
    const deltaLatRad = ((pos2.latitude - pos1.latitude) * Math.PI) / 180;
    const deltaLonRad = ((pos2.longitude - pos1.longitude) * Math.PI) / 180;

    // Haversine formula
    const a =
      Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    // Calculate bearing (initial bearing from pos1 to pos2)
    const y = Math.sin(deltaLonRad) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLonRad);
    let bearing = (Math.atan2(y, x) * 180) / Math.PI;

    // Normalize bearing to 0-360 degrees
    bearing = (bearing + 360) % 360;

    return {
      distance,
      bearing,
      method: 'haversine',
    };
  }

  /**
   * Calculate simple Euclidean distance (for small distances)
   */
  private static calculateEuclideanDistance(
    pos1: Position | IPosition,
    pos2: Position | IPosition,
  ): DistanceCalculation {
    // Convert lat/lng differences to meters (approximate)
    const latDiff = (pos2.latitude - pos1.latitude) * 111320; // 1 degree ≈ 111.32 km
    const lonDiff =
      (pos2.longitude - pos1.longitude) * 111320 * Math.cos((pos1.latitude * Math.PI) / 180);

    const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
    const bearing = (Math.atan2(lonDiff, latDiff) * 180) / Math.PI;

    return {
      distance,
      bearing: (bearing + 360) % 360,
      method: 'euclidean',
    };
  }

  /**
   * Check if this position is within a certain distance of another position
   */
  isWithinDistanceOf(other: Position | IPosition, maxDistance: Distance): boolean {
    return this.distanceTo(other) <= maxDistance;
  }

  /**
   * Get position age in milliseconds
   */
  getAge(): number {
    return Date.now() - this.timestamp.getTime();
  }

  /**
   * Check if position is fresh (within specified age limit)
   */
  isFresh(maxAgeMs: number = 30000): boolean {
    return this.getAge() <= maxAgeMs;
  }

  /**
   * Create a new position with updated timestamp
   */
  withTimestamp(timestamp: Timestamp): Position {
    return new Position({
      latitude: this.latitude,
      longitude: this.longitude,
      altitude: this.altitude,
      accuracy: this.accuracy,
      timestamp,
    });
  }

  /**
   * Convert to plain object (for JSON serialization)
   */
  toJSON(): IPosition {
    return {
      latitude: this.latitude,
      longitude: this.longitude,
      altitude: this.altitude,
      accuracy: this.accuracy,
      timestamp: this.timestamp,
      distanceTo(lastPosition: IPosition): unknown {
        throw new Error('Function not implemented.');
      },
    };
  }

  /**
   * Format position as a human-readable string
   */
  toString(): string {
    const lat = this.latitude.toFixed(6);
    const lng = this.longitude.toFixed(6);
    const alt = this.altitude.toFixed(2);
    const acc = this.accuracy.toFixed(2);
    const time = this.timestamp.toISOString().substring(0, 19).replace('T', ' ');

    return `Position(lat=${lat}, lng=${lng}, alt=${alt}m, acc=${acc}m, time=${time})`;
  }

  /**
   * Format position for display purposes
   */
  toDisplayString(): string {
    const lat = Math.abs(this.latitude).toFixed(6);
    const lng = Math.abs(this.longitude).toFixed(6);
    const latDir = this.latitude >= 0 ? 'N' : 'S';
    const lngDir = this.longitude >= 0 ? 'E' : 'W';

    return `${lat}°${latDir}, ${lng}°${lngDir}`;
  }

  /**
   * Check equality with another position (within tolerance)
   */
  equals(other: Position | IPosition, tolerance: Distance = 1.0): boolean {
    return this.distanceTo(other) <= tolerance;
  }
}

/**
 * Builder class for Position objects
 */
export class PositionBuilder {
  private data: Partial<CreatePositionData> = {};

  withLatitude(latitude: Latitude): PositionBuilder {
    this.data.latitude = latitude;
    return this;
  }

  withLongitude(longitude: Longitude): PositionBuilder {
    this.data.longitude = longitude;
    return this;
  }

  withAltitude(altitude: Altitude): PositionBuilder {
    this.data.altitude = altitude;
    return this;
  }

  withAccuracy(accuracy: Accuracy): PositionBuilder {
    this.data.accuracy = accuracy;
    return this;
  }

  withTimestamp(timestamp: Timestamp): PositionBuilder {
    this.data.timestamp = timestamp;
    return this;
  }

  /**
   * Set coordinates from a coordinate pair
   */
  withCoordinates(latitude: Latitude, longitude: Longitude): PositionBuilder {
    this.data.latitude = latitude;
    this.data.longitude = longitude;
    return this;
  }

  /**
   * Set current timestamp
   */
  withCurrentTimestamp(): PositionBuilder {
    this.data.timestamp = new Date();
    return this;
  }

  build(): Position {
    if (this.data.latitude === undefined || this.data.longitude === undefined) {
      throw new Error('Latitude and longitude are required to build a Position');
    }

    return new Position(this.data as CreatePositionData);
  }
}

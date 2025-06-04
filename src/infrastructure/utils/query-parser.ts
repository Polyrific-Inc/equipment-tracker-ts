/* eslint-disable complexity */
/* eslint-disable max-lines-per-function */
/**
 * Utilities for parsing URL query parameters into proper types
 */

import type {
  EquipmentType,
  EquipmentStatus,
  EquipmentQueryFilter,
  PositionSource,
  PositionQueryFilter,
  PaginationParams,
  TimeRange,
  GeographicBounds,
  EquipmentQueryParams,
  PositionQueryParams,
  PaginationQueryParams,
  TimeRangeQueryParams,
} from '../../types/index.js';

/**
 * Parse comma-separated string into array
 */
const parseCommaSeparated = (value: string | undefined): string[] | undefined => {
  if (!value) {
    return undefined;
  }
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
};

/**
 * Parse string to number with validation
 */
const parseNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

/**
 * Parse string to boolean
 */
const parseBoolean = (value: string | undefined): boolean | undefined => {
  if (!value) {
    return undefined;
  }
  if (value.toLowerCase() === 'true') {
    return true;
  }
  if (value.toLowerCase() === 'false') {
    return false;
  }
  return undefined;
};

/**
 * Parse ISO date string to Date
 */
const parseDate = (value: string | undefined): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/**
 * Parse JSON string with error handling
 */
const parseJSON = <T>(value: string | undefined): T | undefined => {
  if (!value) {
    return undefined;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

/**
 * Convert string-based query parameters to EquipmentQueryFilter
 */
export const parseEquipmentQuery = (query: EquipmentQueryParams): EquipmentQueryFilter => {
  const filter: Partial<EquipmentQueryFilter> = {};

  // Parse equipment types
  if (query.type) {
    const types = parseCommaSeparated(query.type);
    if (types && types.length > 0) {
      filter.type = types.length === 1 ? (types[0] as EquipmentType) : (types as EquipmentType[]);
    }
  }

  // Parse equipment statuses
  if (query.status) {
    const statuses = parseCommaSeparated(query.status);
    if (statuses && statuses.length > 0) {
      filter.status =
        statuses.length === 1 ? (statuses[0] as EquipmentStatus) : (statuses as EquipmentStatus[]);
    }
  }

  // Parse dates
  const createdAfter = parseDate(query.createdAfter);
  if (createdAfter) {
    filter.createdAfter = createdAfter;
  }

  const createdBefore = parseDate(query.createdBefore);
  if (createdBefore) {
    filter.createdBefore = createdBefore;
  }

  const updatedAfter = parseDate(query.updatedAfter);
  if (updatedAfter) {
    filter.updatedAfter = updatedAfter;
  }

  const updatedBefore = parseDate(query.updatedBefore);
  if (updatedBefore) {
    filter.updatedBefore = updatedBefore;
  }

  // Parse booleans
  const hasPosition = parseBoolean(query.hasPosition);
  if (hasPosition !== undefined) {
    filter.hasPosition = hasPosition;
  }

  const isMoving = parseBoolean(query.isMoving);
  if (isMoving !== undefined) {
    filter.isMoving = isMoving;
  }

  return filter as EquipmentQueryFilter;
};

/**
 * Convert string-based query parameters to PositionQueryFilter
 */
export const parsePositionQuery = (query: PositionQueryParams): PositionQueryFilter => {
  const filter: Partial<PositionQueryFilter> = {};

  // Parse equipment IDs
  if (query.equipmentId) {
    const ids = parseCommaSeparated(query.equipmentId);
    if (ids && ids.length > 0) {
      filter.equipmentId = ids.length === 1 ? ids[0] : ids;
    }
  }

  // Parse time range
  if (query.startTime || query.endTime) {
    const start = parseDate(query.startTime);
    const end = parseDate(query.endTime);

    if (start || end) {
      filter.timeRange = {
        start: start ?? new Date(0), // Unix epoch if no start
        end: end ?? new Date(), // Now if no end
      };
    }
  }

  // Parse geographic bounds
  if (query.minLat || query.maxLat || query.minLng || query.maxLng) {
    const minLat = parseNumber(query.minLat);
    const maxLat = parseNumber(query.maxLat);
    const minLng = parseNumber(query.minLng);
    const maxLng = parseNumber(query.maxLng);

    if (
      minLat !== undefined &&
      maxLat !== undefined &&
      minLng !== undefined &&
      maxLng !== undefined
    ) {
      filter.bounds = {
        southWest: { lat: minLat, lng: minLng },
        northEast: { lat: maxLat, lng: maxLng },
      };
    }
  }

  // Parse accuracy range
  const minAccuracy = parseNumber(query.minAccuracy);
  if (minAccuracy !== undefined) {
    filter.minAccuracy = minAccuracy;
  }

  const maxAccuracy = parseNumber(query.maxAccuracy);
  if (maxAccuracy !== undefined) {
    filter.maxAccuracy = maxAccuracy;
  }

  // Parse position sources
  if (query.source) {
    const sources = parseCommaSeparated(query.source);
    if (sources && sources.length > 0) {
      filter.source =
        sources.length === 1 ? (sources[0] as PositionSource) : (sources as PositionSource[]);
    }
  }

  // Parse speed-related filters
  const hasSpeed = parseBoolean(query.hasSpeed);
  if (hasSpeed !== undefined) {
    filter.hasSpeed = hasSpeed;
  }

  const minSpeed = parseNumber(query.minSpeed);
  if (minSpeed !== undefined) {
    filter.minSpeed = minSpeed;
  }

  const maxSpeed = parseNumber(query.maxSpeed);
  if (maxSpeed !== undefined) {
    filter.maxSpeed = maxSpeed;
  }

  return filter as PositionQueryFilter;
};

/**
 * Convert string-based pagination parameters to PaginationParams
 */
export const parsePaginationQuery = (query: PaginationQueryParams): PaginationParams => {
  const page = parseNumber(query.page) ?? 1;
  const limit = parseNumber(query.limit) ?? 20;

  const pagination: PaginationParams = { page, limit };

  if (query.sortBy) {
    return { ...pagination, sortBy: query.sortBy };
  }

  if (query.sortOrder && (query.sortOrder === 'asc' || query.sortOrder === 'desc')) {
    return { ...pagination, sortOrder: query.sortOrder };
  }

  return pagination;
};

/**
 * Convert string-based time range parameters to TimeRange
 */
export const parseTimeRangeQuery = (query: TimeRangeQueryParams): TimeRange | undefined => {
  const start = parseDate(query.start);
  const end = parseDate(query.end);

  if (!start && !end) {
    return undefined;
  }

  return {
    start: start ?? new Date(0), // Unix epoch if no start
    end: end ?? new Date(), // Now if no end
  };
};

/**
 * Parse geographic bounds from JSON string
 */
export const parseGeographicBounds = (
  boundsJson: string | undefined,
): GeographicBounds | undefined => {
  return parseJSON<GeographicBounds>(boundsJson);
};

/**
 * Validate pagination parameters
 */
export const validatePagination = (pagination: PaginationParams): PaginationParams => {
  return {
    ...pagination,
    page: Math.max(1, pagination.page),
    limit: Math.min(Math.max(1, pagination.limit), 100), // Cap at 100 items per page
  };
};

/**
 * Sanitize and validate query filter for equipment
 */
export const sanitizeEquipmentQuery = (
  query: EquipmentQueryParams & PaginationQueryParams,
): {
  filter: EquipmentQueryFilter;
  pagination: PaginationParams;
} => {
  return {
    filter: parseEquipmentQuery(query),
    pagination: validatePagination(parsePaginationQuery(query)),
  };
};

/**
 * Sanitize and validate query filter for positions
 */
export const sanitizePositionQuery = (
  query: PositionQueryParams & PaginationQueryParams,
): {
  filter: PositionQueryFilter;
  pagination: PaginationParams;
} => {
  return {
    filter: parsePositionQuery(query),
    pagination: validatePagination(parsePaginationQuery(query)),
  };
};

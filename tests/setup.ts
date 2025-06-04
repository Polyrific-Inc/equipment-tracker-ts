/**
 * Jest setup file for global test configuration
 */

// Global test timeout
jest.setTimeout(10000);

// Mock console methods in tests to reduce noise
const originalConsole = global.console;

beforeAll(() => {
  global.console = {
    ...originalConsole,
    // Suppress console.log in tests unless explicitly needed
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

afterAll(() => {
  global.console = originalConsole;
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidTimestamp(): R;
      toBeValidCoordinate(): R;
    }
  }
}

// Custom matchers
expect.extend({
  toBeValidTimestamp(received: unknown) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid timestamp`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid timestamp`,
        pass: false,
      };
    }
  },

  toBeValidCoordinate(received: unknown) {
    const pass = typeof received === 'number' && 
                 !isNaN(received) && 
                 received >= -180 && 
                 received <= 180;
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid coordinate`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid coordinate`,
        pass: false,
      };
    }
  },
});

export {};
/**
 * Basic test to verify our setup is working
 */

import { welcome } from '../src/app.js';

describe('Application Setup', () => {
  test('welcome function should return greeting message', () => {
    const result = welcome('Test App');
    expect(result).toBe('Welcome to Test App!');
  });

  test('welcome function should handle empty string', () => {
    const result = welcome('');
    expect(result).toBe('Welcome to !');
  });

  test('welcome function should be defined', () => {
    expect(welcome).toBeDefined();
    expect(typeof welcome).toBe('function');
  });
});

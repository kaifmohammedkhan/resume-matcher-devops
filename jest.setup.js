// jest.setup.js
import '@testing-library/jest-dom';
import { expect } from '@jest/globals';
import * as matchers from '@testing-library/jest-dom/matchers';

// Explicitly extend Jest's global expect with proper ESM fallback handling
const resolvedMatchers = matchers.default || matchers;
expect.extend(resolvedMatchers);

if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}
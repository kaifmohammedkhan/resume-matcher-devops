/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.jsx'],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^api/(.*)$': '<rootDir>/api/$1',
    '^lib/(.*)$': '<rootDir>/lib/$1',
  },

  coverageProvider: 'v8',
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],

  setupFiles: ['./jest.polyfills.js'],
  setupFilesAfterEnv: ['./jest.setup.js'],

  transform: {
    '^.+\\.(js|jsx)$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          ['@babel/preset-react', { runtime: 'automatic' }]
        ]
      }
    ]
  },

  // ✅ Always collect coverage
  collectCoverage: true,

  collectCoverageFrom: [
    'lib/**/*.js',
    'api/**/*.js',
    'src/**/*.{js,jsx}',
    'server.js',
    '!**/node_modules/**'
  ],

  // ✅ Ignore setup/polyfill files
  coveragePathIgnorePatterns: [
    '/node_modules/',
    'jest.polyfills.js',
    'jest.setup.js'
  ],

  // ✅ Explicit test discovery
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],

  // ✅ Force coverage reporters so output is visible
  coverageReporters: ['text', 'text-summary', 'lcov', 'html']
};

export default config;
/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.jsx'],

  // Safe non-greedy module mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
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

  collectCoverageFrom: [
    'lib/**/*.js',
    'api/**/*.js',
    'src/**/*.{js,jsx}',
    'server.js',
    '!**/node_modules/**'
  ]
};

export default config;
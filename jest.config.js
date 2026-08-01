/** @type {import('jest').Config} */
const config = {
  // Use V8 engine coverage to support native ESM dynamic imports
  coverageProvider: 'v8',
  
  // Do not transform files with Babel when running native ESM
  transform: {},

  // Collect coverage from your application files
  collectCoverageFrom: [
    'lib/**/*.js',
    'api/**/*.js',
    'src/**/*.js',
    'server.js',
    '!**/node_modules/**'
  ]
};

export default config;
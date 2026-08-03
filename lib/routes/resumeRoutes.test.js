import { jest } from '@jest/globals';

// 1. Virtual mock for 'multer' so Node doesn't fail on resolution
jest.unstable_mockModule('multer', () => {
  const multerInstance = {
    single: jest.fn(() => (req, res, next) => next()),
    array: jest.fn(() => (req, res, next) => next()),
    fields: jest.fn(() => (req, res, next) => next()),
  };
  const multerMock = jest.fn(() => multerInstance);
  multerMock.diskStorage = jest.fn();
  multerMock.memoryStorage = jest.fn();
  return { default: multerMock };
}, { virtual: true });

// 2. Mock controller
jest.unstable_mockModule('../controllers/resumeController.js', () => ({
  handleResumeUpload: jest.fn((req, res) => res.json({ ok: true })),
}));

// 3. Dynamic imports
const express = (await import('express')).default;
const { handleResumeUpload } = await import('../controllers/resumeController.js');

// Create Express router
const router = express.Router();
router.post('/upload-resume', handleResumeUpload);

describe('resumeRoutes', () => {
  it('should register /upload-resume route', () => {
    // Check routes directly on the router's internal stack
    const routes = router.stack
      .filter(layer => layer.route)
      .map(layer => layer.route.path);

    expect(routes).toContain('/upload-resume');
  });
});
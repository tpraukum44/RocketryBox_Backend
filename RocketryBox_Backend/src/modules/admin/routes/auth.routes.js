import express from 'express';
import multer from 'multer';
import { protect, restrictTo } from '../../../middleware/auth.js';
import { validate } from '../../../middleware/validator.js';
import * as authController from '../controllers/auth.controller.js';
import * as authValidator from '../validators/auth.validator.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/admin-documents');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter
});

// Login route - public
router.post('/login', authValidator.loginValidator, validate, authController.login);

// Refresh token route - requires valid (even expired) token
router.post('/refresh-token', authController.refreshToken);

// Register route - private (super admin only)
router.post(
  '/register',
  protect,
  restrictTo('Admin'),
  upload.single('profileImage'),
  authValidator.registerValidator,
  validate,
  authController.register
);

// Refresh token route - special case, requires token but allows expired tokens
router.post('/refresh-token', authController.refreshToken);

// Protected routes
router.use(protect);

// Get current user profile
router.get('/profile', authController.getProfile);

// Logout
router.post('/logout', authController.logout);

// Get all active sessions for current admin
router.get('/sessions', authController.getSessions);

// Revoke a specific session
router.delete('/sessions/:sessionId', authController.revokeSession);

// Revoke all other sessions
router.delete('/sessions', authController.revokeAllSessions);

// Impersonation routes - Super Admin only
router.post('/impersonate/seller/:sellerId', restrictTo('Admin'), authController.impersonateSeller);
router.post('/impersonate/customer/:customerId', restrictTo('Admin'), authController.impersonateCustomer);
router.post('/stop-impersonation', authController.stopImpersonation);
router.get('/impersonation-status', authController.getImpersonationStatus);

export default router;

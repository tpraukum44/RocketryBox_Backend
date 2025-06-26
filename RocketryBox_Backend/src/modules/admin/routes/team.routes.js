import express from 'express';
import multer from 'multer';
import { checkAdminPermission, requireSuperAdmin } from '../../../middleware/adminPermission.js';
import { protect, restrictTo } from '../../../middleware/auth.js';
import { validate } from '../../../middleware/validator.js';
import * as teamController from '../controllers/team.controller.js';
import * as teamValidator from '../validators/team.validator.js';

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
  // Accept common document types and images
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPEG, JPG, PNG, and WebP files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter
});

// All team routes are protected and restricted to Admin/Manager
router.use(protect);
router.use(restrictTo('Admin', 'Manager'));

// Get system sections and their access statistics
router.get('/sections', restrictTo('Admin'), teamController.getSystemSections);

// Get all team members - requires teamManagement permission
router.get('/', checkAdminPermission('teamManagement'), ...teamValidator.teamQueryValidator, validate, teamController.getAllTeamMembers);

// Register a new team member with optional document uploads - SUPER ADMIN ONLY
const documentUpload = upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'aadharDocument', maxCount: 1 },
  { name: 'panDocument', maxCount: 1 },
  { name: 'bankPassbookDocument', maxCount: 1 }
]);

router.post('/register', requireSuperAdmin, documentUpload, ...teamValidator.registerTeamMemberValidator, validate, teamController.registerTeamMember);

// Debug endpoint for development only
if (process.env.NODE_ENV === 'development') {
  router.get('/debug-profile/:userId', ...teamValidator.teamIdValidator, validate, teamController.debugProfileImage);
}

// Get team member details - requires teamManagement permission
router.get('/:userId', checkAdminPermission('teamManagement'), ...teamValidator.teamIdValidator, validate, teamController.getTeamMemberDetails);

// Get detailed team member profile with history
router.get(
  '/:userId/profile',
  ...teamValidator.teamIdValidator,
  validate,
  restrictTo('Admin'), // Only full admins can see detailed profiles
  teamController.getTeamMemberProfile
);

// Update team member - SUPER ADMIN ONLY
router.patch(
  '/:userId',
  requireSuperAdmin,
  ...teamValidator.updateTeamMemberValidator,
  validate,
  teamController.updateTeamMember
);

// Update team member status - SUPER ADMIN ONLY
router.patch(
  '/:userId/status',
  requireSuperAdmin,
  ...teamValidator.updateStatusValidator,
  validate,
  teamController.updateTeamMemberStatus
);

// Update team member permissions - SUPER ADMIN ONLY
router.patch(
  '/:userId/permissions',
  requireSuperAdmin,
  ...teamValidator.updatePermissionsValidator,
  validate,
  teamController.updateTeamMemberPermissions
);

// Upload team member documents
router.post(
  '/:userId/documents',
  ...teamValidator.uploadDocumentValidator,
  validate,
  upload.single('document'),
  teamController.uploadTeamMemberDocuments
);

export default router;

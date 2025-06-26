import express from 'express';
import multer from 'multer';
import { checkAdminPermission, requireSuperAdmin } from '../../../middleware/adminPermission.js';
import { protect, restrictTo } from '../../../middleware/auth.js';
import { validate, validationHandler } from '../../../middleware/validator.js';
import * as userController from '../controllers/user.controller.js';
import { validateCreateRateCards } from '../validators/billing.validator.js';
import * as userValidator from '../validators/user.validator.js';
import { updateSellerBankDetailsSchema, updateSellerRateBandSchema, validateSellerIdParam } from '../validators/user.validator.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/seller-documents');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// All user routes are protected for admins
router.use(protect);
router.use(restrictTo('Admin', 'Manager'));

// Specific routes MUST come before generic /:id route
// Sellers routes
router.get('/sellers', userController.getAllSellers);
router.get('/sellers/:id', userController.getSellerDetails);
router.patch('/sellers/:id/status', userController.updateSellerStatus);
router.patch('/sellers/:id/kyc', userController.updateSellerKYC);
router.patch('/sellers/:id/bank-details', validateSellerIdParam, validate, validationHandler(updateSellerBankDetailsSchema), userController.updateSellerBankDetails);
router.post('/sellers/:id/agreements', userController.createSellerAgreement);

// Seller rate card management (new override system)
router.get('/sellers/:id/ratecards', userController.getSellerRateCards);
router.post('/sellers/:id/ratecards', validateCreateRateCards, userController.manageSellerRateCard);
router.delete('/sellers/:id/ratecards/:overrideId', userController.removeSellerRateCardOverride);

// Seller rate band assignment
router.patch('/sellers/:id/rate-band', validateSellerIdParam, validate, validationHandler(updateSellerRateBandSchema), userController.updateSellerRateBand);

// Customers routes
router.get('/customers', userController.getAllCustomers);
router.get('/customers/:id', userController.getCustomerDetails);
router.patch('/customers/:id/status', userController.updateCustomerStatus);

// Real-time user data
router.post('/realtime', userController.getRealtimeUserData);

// Generic user routes (MUST come after specific routes)
router.get('/', checkAdminPermission('userManagement'), ...userValidator.userQueryValidator, validate, userController.getAllUsers);
router.get('/:id', checkAdminPermission('userManagement'), ...userValidator.userIdValidator, validate, userController.getUserDetails);
router.patch('/:id/status', checkAdminPermission('userManagement'), ...userValidator.updateUserStatusValidator, validate, userController.updateUserStatus);
router.patch('/:id/permissions', requireSuperAdmin, ...userValidator.updateUserPermissionsValidator, validate, userController.updateUserPermissions);

export default router;

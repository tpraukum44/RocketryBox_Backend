import express from 'express';
import { body, query } from 'express-validator';
import { validationHandler as validate } from '../../../middleware/validator.js';
import { protect, restrictTo } from '../../../middleware/auth.js';
import { defaultLimiter } from '../../../middleware/rateLimiter.js';
import { submitContact, getAllContacts, getContactById } from '../controllers/contact.controller.js';
import { registerPartner, getAllPartners, updatePartnerStatus } from '../controllers/partner.controller.js';
import { getTrackingInfo, updateTrackingStatus, getAllTracking } from '../controllers/tracking.controller.js';

const router = express.Router();

// Apply default rate limiter to all routes
router.use(defaultLimiter);

// Public routes
router.post(
  '/contact',
  [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('message').notEmpty().withMessage('Message is required')
  ],
  validate,
  submitContact
);

router.post(
  '/partner/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('businessName').notEmpty().withMessage('Business name is required'),
    body('businessType').notEmpty().withMessage('Business type is required'),
    body('message').notEmpty().withMessage('Message is required')
  ],
  validate,
  registerPartner
);

// Protected admin routes
router.use(protect);
router.use(restrictTo('admin'));

// Contact management
router.get('/contacts', getAllContacts);
router.get('/contacts/:id', getContactById);

// Partner management
router.get('/partners', getAllPartners);
router.patch('/partners/:id/status', updatePartnerStatus);

// Tracking management
router.get('/tracking', getAllTracking);
router.get('/tracking/:id', getTrackingInfo);
router.patch('/tracking/:id/status', updateTrackingStatus);

export default router; 
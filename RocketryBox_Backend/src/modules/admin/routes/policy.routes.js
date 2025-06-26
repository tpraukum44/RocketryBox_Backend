import express from 'express';
import {
  listPolicies,
  getPolicyBySlug,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getPolicyByType,
  getDefaultPolicies
} from '../controllers/policy.controller.js';
import {
  validateCreatePolicy,
  validateUpdatePolicy,
  validateGetPolicy,
  validateGetPolicyByType,
  validateListPolicies
} from '../validators/policy.validator.js';
import { protect } from '../../../middleware/auth.js';
import { checkPermission } from '../../../middleware/permission.js';

const router = express.Router();

// Get all policies with pagination
router.get(
  '/',
  protect,
  checkPermission('settings'),
  validateListPolicies,
  listPolicies
);

// Get all default policies
router.get(
  '/defaults',
  protect,
  checkPermission('settings'),
  getDefaultPolicies
);

// Get policy by type
router.get(
  '/type/:type',
  protect,
  checkPermission('settings'),
  validateGetPolicyByType,
  getPolicyByType
);

// Get policy by slug
router.get(
  '/:slug',
  protect,
  checkPermission('settings'),
  validateGetPolicy,
  getPolicyBySlug
);

// Create new policy
router.post(
  '/',
  protect,
  checkPermission('settings'),
  validateCreatePolicy,
  createPolicy
);

// Update policy
router.put(
  '/:slug',
  protect,
  checkPermission('settings'),
  validateUpdatePolicy,
  updatePolicy
);

// Delete policy
router.delete(
  '/:slug',
  protect,
  checkPermission('settings'),
  validateGetPolicy,
  deletePolicy
);

export default router; 
import express from 'express';
import { authenticateSeller } from '../../../middleware/auth.js';
import { validationHandler } from '../../../middleware/validator.js';
import {
  addTeamUser,
  deleteTeamUser,
  getAuditLogs,
  getRolesAndPermissions,
  getTeamUser,
  listTeamUsers,
  resetTeamUserPassword,
  updateTeamUser
} from '../controllers/teamUser.controller.js';
import {
  addTeamUserSchema,
  updateTeamUserSchema
} from '../validators/teamUser.validator.js';

const router = express.Router();

// All routes require seller authentication
router.use(authenticateSeller);

// Get available roles and their permissions
router.get('/roles', getRolesAndPermissions);

// Get audit logs
router.get('/audit-logs', getAuditLogs);

// List team users with filters and pagination
router.get('/', listTeamUsers);

// Add new team user
router.post('/', validationHandler(addTeamUserSchema), addTeamUser);

// Get team user details
router.get('/:id', getTeamUser);

// Update team user
router.put('/:id', validationHandler(updateTeamUserSchema), updateTeamUser);

// Delete team user
router.delete('/:id', deleteTeamUser);

// Reset team user password (admin only)
router.post('/:id/reset-password', resetTeamUserPassword);

export default router;

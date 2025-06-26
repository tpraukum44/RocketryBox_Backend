import express from 'express';
import { authenticateTeamUser } from '../../../middleware/auth.js';
import { authLimiter } from '../../../middleware/rateLimiter.js';
import { validationHandler as validateRequest } from '../../../middleware/validator.js';
import {
  changeTeamUserPassword,
  getTeamUserProfile,
  teamUserLogin,
  teamUserLogout,
  teamUserRefreshToken,
  updateTeamUserProfile
} from '../controllers/teamUserAuth.controller.js';
import {
  teamUserChangePasswordSchema,
  teamUserLoginSchema,
  teamUserRefreshTokenSchema,
  teamUserUpdateProfileSchema
} from '../validators/teamUserAuth.validator.js';

const router = express.Router();

// Team User Authentication Routes with rate limiting
router.post('/login', authLimiter, validateRequest(teamUserLoginSchema), teamUserLogin);
router.post('/refresh-token', authLimiter, validateRequest(teamUserRefreshTokenSchema), teamUserRefreshToken);
router.post('/logout', authenticateTeamUser, teamUserLogout);

// Team User Profile Routes (require authentication)
router.get('/profile', authenticateTeamUser, getTeamUserProfile);
router.patch('/profile', authenticateTeamUser, validateRequest(teamUserUpdateProfileSchema), updateTeamUserProfile);
router.patch('/change-password', authenticateTeamUser, validateRequest(teamUserChangePasswordSchema), changeTeamUserPassword);

export default router;

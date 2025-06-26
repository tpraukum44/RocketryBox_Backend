import express from 'express';
import { authenticateAdmin } from '../../../middleware/auth.js';
import { getSellerDetails } from '../controllers/user.controller.js';

const router = express.Router();

// Admin routes for seller details
router.get('/sellers/:sellerId', authenticateAdmin, getSellerDetails);

export default router; 
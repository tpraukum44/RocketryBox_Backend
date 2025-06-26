import express from 'express';
import { authenticateSeller } from '../../../middleware/auth.js';
import {
  acceptAgreement,
  downloadAgreement,
  getSellerAgreements,
  rejectAgreement
} from '../controllers/agreement.controller.js';

const router = express.Router();

// All routes require seller authentication
router.use(authenticateSeller);

// Get all agreements for the seller
router.get('/', getSellerAgreements);

// Accept an agreement
router.post('/:agreementId/accept', acceptAgreement);

// Reject an agreement
router.post('/:agreementId/reject', rejectAgreement);

// Download agreement document
router.get('/:agreementId/download', downloadAgreement);

export default router;

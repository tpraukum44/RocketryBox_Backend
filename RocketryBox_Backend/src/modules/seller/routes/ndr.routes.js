import express from 'express';
import { listNDRs, getNDR, updateNDRStatus, createNDR } from '../controllers/ndr.controller.js';
import { authenticateSeller } from '../../../middleware/auth.js';
import { validateCreateNDR, validateUpdateNDRStatus } from '../validators/ndr.validator.js';

const router = express.Router();

router.use(authenticateSeller);

// List NDRs
router.get('/', listNDRs);

// Get NDR details
router.get('/:id', getNDR);

// Update NDR status
router.put('/:id/status', validateUpdateNDRStatus, updateNDRStatus);

// Create NDR (manual/testing)
router.post('/', validateCreateNDR, createNDR);

export default router; 

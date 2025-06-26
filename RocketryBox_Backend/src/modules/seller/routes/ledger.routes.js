import express from 'express';
import { authenticateSeller } from '../../../middleware/auth.js';
import {
  listLedgerEntries,
  getLedgerEntry,
  exportLedgerEntries
} from '../controllers/ledger.controller.js';

const router = express.Router();

// All routes are authenticateSellered
router.use(authenticateSeller);

// List ledger entries with filters and pagination
router.get('/', listLedgerEntries);

// Get ledger entry details
router.get('/:id', getLedgerEntry);

// Export ledger entries
router.get('/export', exportLedgerEntries);

export default router; 

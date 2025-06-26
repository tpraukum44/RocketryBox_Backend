import express from 'express';
import { authenticateSellerOrTeamUser } from '../../../middleware/auth.js';
import { requireBasicProfile, requireDocumentUpload } from '../../../middleware/documentVerification.js';
import { checkPermission } from '../../../middleware/permission.js';
import { creditCODToWallet, creditToWallet, exportWalletTransactions, getWalletBalance, getWalletSummary, getWalletTransaction, initiateRecharge, listWalletTransactions, verifyRecharge } from '../controllers/wallet.controller.js';

const router = express.Router();

// Apply seller or team user authentication to all routes
router.use(authenticateSellerOrTeamUser);

// Wallet viewing operations - require basic profile only
router.get('/balance', checkPermission('Wallet'), requireBasicProfile, getWalletBalance);
router.get('/summary', checkPermission('Wallet'), requireBasicProfile, getWalletSummary);
router.get('/history', checkPermission('Wallet'), requireBasicProfile, listWalletTransactions);
router.get('/transactions', checkPermission('Wallet'), requireBasicProfile, listWalletTransactions);
router.get('/:id', checkPermission('Wallet'), requireBasicProfile, getWalletTransaction);
router.get('/export', checkPermission('Wallet'), requireBasicProfile, exportWalletTransactions);

// Financial operations - require complete document upload for security
router.post('/recharge/initiate', checkPermission('Wallet'), requireDocumentUpload, initiateRecharge);
router.post('/recharge/verify', checkPermission('Wallet'), requireDocumentUpload, verifyRecharge);

// Admin/system operations - require complete documents
router.post('/cod-credit', checkPermission('Wallet'), requireDocumentUpload, creditCODToWallet);
router.post('/credit', checkPermission('Wallet'), requireDocumentUpload, creditToWallet);

export default router;

import express from 'express';
import multer from 'multer';
import { authenticateSeller } from '../../../middleware/auth.js';
import { getDocumentUploadStatus } from '../../../middleware/documentVerification.js';
import { authLimiter } from '../../../middleware/rateLimiter.js';
import { validationHandler as validateRequest } from '../../../middleware/validator.js';
import { login, logout, refreshToken, register, resetPassword, sendOTP, verifyOTP } from '../controllers/auth.controller.js';
import { calculateRateCard, getSellerRateCard } from '../controllers/billing.controller.js';
import {
  getDocuments,
  getDocumentSignedUrl,
  getProfile,
  updateBankDetails,
  updateCompanyDetails,
  updateDocument,
  updateProfile,
  updateStoreLinks,
  uploadAadhaarDocument,
  uploadCancelledCheque,
  uploadGstDocument,
  uploadPanDocument
} from '../controllers/profile.controller.js';
import {
  bankDetailsSchema,
  companyDetailsSchema,
  documentUpdateSchema,
  loginSchema,
  profileUpdateSchema,
  registerSchema,
  resetPasswordSchema,
  sendOTPSchema,
  verifyOTPSchema
} from '../validators/seller.validator.js';

const router = express.Router();

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/seller-documents/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept PDF and image files
  if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and image files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

// Multer error handler
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size allowed is 10MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: 'File upload error: ' + error.message
    });
  }

  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  next(error);
};

// Seller Authentication Routes with rate limiting
router.post('/auth/register', authLimiter, validateRequest(registerSchema), register);
router.post('/auth/login', authLimiter, validateRequest(loginSchema), login);
router.post('/auth/otp/send', authLimiter, validateRequest(sendOTPSchema), sendOTP);
router.post('/auth/otp/verify', authLimiter, validateRequest(verifyOTPSchema), verifyOTP);
router.post('/auth/reset-password', authLimiter, validateRequest(resetPasswordSchema), resetPassword);
router.post('/auth/refresh-token', authLimiter, refreshToken);
router.post('/auth/logout', authenticateSeller, logout);

// Profile Routes
router.get('/profile', authenticateSeller, getProfile);
router.patch('/profile', authenticateSeller, validateRequest(profileUpdateSchema), updateProfile);
router.patch('/profile/company-details', authenticateSeller, validateRequest(companyDetailsSchema), updateCompanyDetails);
router.patch('/profile/bank-details', authenticateSeller, validateRequest(bankDetailsSchema), updateBankDetails);
router.put('/profile/store-links', authenticateSeller, updateStoreLinks);

// Document Routes
router.get('/documents', authenticateSeller, getDocuments);
router.post('/documents', authenticateSeller, validateRequest(documentUpdateSchema), updateDocument);

// S3 Document Upload Routes
router.post('/documents/gst/upload', authenticateSeller, upload.single('gstDocument'), handleMulterError, uploadGstDocument);
router.post('/documents/pan/upload', authenticateSeller, upload.single('panDocument'), handleMulterError, uploadPanDocument);
router.post('/documents/aadhaar/upload', authenticateSeller, upload.single('aadhaarDocument'), handleMulterError, uploadAadhaarDocument);
router.post('/documents/cheque/upload', authenticateSeller, upload.single('cancelledCheque'), handleMulterError, uploadCancelledCheque);

// Get signed URLs for documents
router.get('/documents/:documentType/url', authenticateSeller, getDocumentSignedUrl);

// Document Status Route - Shows upload requirements and progress
router.get('/document-status', authenticateSeller, (req, res) => {
  try {
    const documentStatus = getDocumentUploadStatus(req.user);

    res.json({
      success: true,
      data: {
        ...documentStatus,
        businessFeatures: {
          available: documentStatus.adminVerified,
          blockedFeatures: documentStatus.adminVerified ? [] : [
            'Order Management',
            'Shipment Processing',
            'Bulk Orders',
            'Financial Operations',
            'Rate Card Management',
            'Store & Product Management',
            'Team Management'
          ],
          allowedFeatures: [
            'Profile Management',
            'Document Upload',
            'Support Access',
            'Basic Dashboard'
          ]
        },
        kycStatus: {
          documentsUploaded: documentStatus.documentsUploaded,
          adminVerification: documentStatus.adminVerified ? 'verified' : 'pending',
          status: documentStatus.status,
          message: documentStatus.message
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get document status',
      message: error.message
    });
  }
});

// Rate Card Routes
router.get('/rate-card', authenticateSeller, getSellerRateCard);
router.post('/rate-card/calculate', authenticateSeller, calculateRateCard);

export default router;

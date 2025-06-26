import fs from 'fs';
import path from 'path';
import { AppError } from '../../../middleware/errorHandler.js';
import { deleteFromS3, generateSignedUrl, uploadToS3 } from '../../../utils/fileUpload.js';
import Seller from '../models/seller.model.js';

// Get seller profile
export const getProfile = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.user.id);

    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Enhance the seller data with additional computed fields
    const sellerData = seller.toObject();

    // Calculate KYC status for profile display
    let kycStatus = 'pending';
    if (seller.documents) {
      const gstStatus = seller.documents.gstin?.status || 'pending';
      const panStatus = seller.documents.pan?.status || 'pending';
      const aadhaarStatus = seller.documents.aadhaar?.status || 'pending';

      if (gstStatus === 'verified' && panStatus === 'verified' && aadhaarStatus === 'verified') {
        kycStatus = 'verified';
      } else if (gstStatus === 'rejected' || panStatus === 'rejected' || aadhaarStatus === 'rejected') {
        kycStatus = 'rejected';
      }
    }

    // Determine rate band - RBX1 is the default base rate card for all sellers
    // Admins can later assign different rate bands to specific sellers
    let rateBand = 'RBX1'; // Default base rate card
    let rateBandDescription = 'Base rate card for all sellers';
    let isCustomAssigned = false;

    // Check if seller has a custom rate band assigned by admin
    if (seller.rateBand && seller.rateBand.trim() !== '') {
      rateBand = seller.rateBand;
      rateBandDescription = 'Custom rate band assigned by admin';
      isCustomAssigned = true;
    } else if (seller.rateCard && seller.rateCard.name) {
      // If populated rateCard object exists, use its name
      rateBand = seller.rateCard.name;
      rateBandDescription = seller.rateCard.description || 'Rate card assigned by admin';
      isCustomAssigned = true;
    }

    // Add rate band information
    sellerData.rateBand = rateBand;
    sellerData.rateCardDetails = {
      name: rateBand,
      description: rateBandDescription,
      isActive: true,
      assignedAt: seller.createdAt,
      isCustom: isCustomAssigned,
      isDefault: rateBand === 'RBX1' && !isCustomAssigned
    };

    sellerData.kycStatus = kycStatus;

    // Add payment type (default to wallet if not set)
    if (!sellerData.paymentType) {
      sellerData.paymentType = 'wallet';
    }

    // Add additional useful fields
    sellerData.accountTier = kycStatus === 'verified' ? 'Verified Business' : 'Standard Account';
    sellerData.isVerified = kycStatus === 'verified';

    console.log('📊 Seller profile data enhanced:', {
      sellerId: seller._id,
      rateBand: sellerData.rateBand,
      kycStatus: sellerData.kycStatus,
      paymentType: sellerData.paymentType,
      accountTier: sellerData.accountTier,
      isVerified: sellerData.isVerified
    });

    res.status(200).json({
      success: true,
      data: sellerData
    });
  } catch (error) {
    console.error('❌ Error in getProfile:', error);
    next(new AppError(error.message, 400));
  }
};

// Update seller profile
export const updateProfile = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Handle address field mapping: frontend sends postalCode, backend expects pincode
    const updateData = { ...req.body };
    if (updateData.address && updateData.address.postalCode) {
      updateData.address.pincode = updateData.address.postalCode;
      delete updateData.address.postalCode;
    }

    const updatedSeller = await seller.updateSafe(updateData);
    res.status(200).json({
      success: true,
      data: updatedSeller
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Update company details
export const updateCompanyDetails = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    const { companyCategory, documents, address } = req.body;

    // Update company category
    seller.companyCategory = companyCategory;

    // Update documents
    if (documents) {
      if (documents.gstin) {
        seller.documents.gstin = {
          ...seller.documents.gstin,
          ...documents.gstin,
          status: 'pending'
        };
      }
      if (documents.pan) {
        seller.documents.pan = {
          ...seller.documents.pan,
          ...documents.pan,
          status: 'pending'
        };
      }
      if (documents.aadhaar) {
        seller.documents.aadhaar = {
          ...seller.documents.aadhaar,
          ...documents.aadhaar,
          status: 'pending'
        };
      }
    }

    // Update address
    if (address) {
      // Handle field mapping: frontend sends postalCode, backend expects pincode
      if (address.postalCode) {
        address.pincode = address.postalCode;
        delete address.postalCode;
      }

      seller.address = {
        ...seller.address,
        ...address
      };
    }

    await seller.save();

    res.status(200).json({
      success: true,
      data: seller
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Update bank details
export const updateBankDetails = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    const { accountType, bankName, accountNumber, accountHolderName, branchName, ifscCode, cancelledCheque } = req.body;

    // Update bank details
    seller.bankDetails = {
      accountType,
      bankName,
      accountNumber,
      accountHolderName,
      branchName,
      ifscCode,
      cancelledCheque: {
        ...cancelledCheque,
        status: 'pending'
      }
    };

    await seller.save();

    res.status(200).json({
      success: true,
      data: seller
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Get seller documents
export const getDocuments = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Generate signed URLs for existing documents
    const gstinUrl = seller.documents?.gstin?.url ? await generateSignedUrl(seller.documents.gstin.url) : '';
    const panUrl = seller.documents?.pan?.url ? await generateSignedUrl(seller.documents.pan.url) : '';
    const aadhaarUrl = seller.documents?.aadhaar?.url ? await generateSignedUrl(seller.documents.aadhaar.url) : '';
    const cancelledChequeUrl = seller.bankDetails?.cancelledCheque?.url ? await generateSignedUrl(seller.bankDetails.cancelledCheque.url) : '';

    // Create completely flat, React-safe response structure
    // Each document field is a simple primitive value to prevent rendering errors
    const documentsData = {
      // GST Document - flat structure
      gstinNumber: seller.documents?.gstin?.number || '',
      gstinUrl: gstinUrl,
      gstinStatus: seller.documents?.gstin?.status || 'pending',
      gstinUploaded: !!(seller.documents?.gstin?.url),

      // PAN Document - flat structure
      panNumber: seller.documents?.pan?.number || '',
      panUrl: panUrl,
      panStatus: seller.documents?.pan?.status || 'pending',
      panUploaded: !!(seller.documents?.pan?.url),

      // Aadhaar Document - flat structure
      aadhaarNumber: seller.documents?.aadhaar?.number || '',
      aadhaarUrl: aadhaarUrl,
      aadhaarStatus: seller.documents?.aadhaar?.status || 'pending',
      aadhaarUploaded: !!(seller.documents?.aadhaar?.url),

      // Cancelled Cheque - flat structure
      cancelledChequeUrl: cancelledChequeUrl,
      cancelledChequeStatus: seller.bankDetails?.cancelledCheque?.status || 'pending',
      cancelledChequeUploaded: !!(seller.bankDetails?.cancelledCheque?.url),

      // Other documents count
      otherDocumentsCount: seller.documents?.others?.length || 0,

      // Overall status - simple primitives
      totalRequired: 4,
      totalUploaded: [
        !!(seller.documents?.gstin?.url),
        !!(seller.documents?.pan?.url),
        !!(seller.documents?.aadhaar?.url),
        !!(seller.bankDetails?.cancelledCheque?.url)
      ].filter(Boolean).length,
      completionPercentage: Math.round([
        !!(seller.documents?.gstin?.url),
        !!(seller.documents?.pan?.url),
        !!(seller.documents?.aadhaar?.url),
        !!(seller.bankDetails?.cancelledCheque?.url)
      ].filter(Boolean).length / 4 * 100),
      allCompleted: [
        !!(seller.documents?.gstin?.url),
        !!(seller.documents?.pan?.url),
        !!(seller.documents?.aadhaar?.url),
        !!(seller.bankDetails?.cancelledCheque?.url)
      ].every(Boolean)
    };

    // Also provide original structure for any existing code that needs it
    // But keep it in a separate field to avoid accidental rendering
    const legacyData = {
      gstin: seller.documents?.gstin || { status: 'pending' },
      pan: seller.documents?.pan || { status: 'pending' },
      aadhaar: seller.documents?.aadhaar || { status: 'pending' },
      others: seller.documents?.others || []
    };

    res.status(200).json({
      success: true,
      data: documentsData,
      legacy: legacyData,
      message: 'Documents retrieved successfully'
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Update document
export const updateDocument = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    const { documentType, documentNumber, documentUrl, documentName } = req.body;

    // Handle different document types
    switch (documentType) {
      case 'gstin':
        seller.documents.gstin = {
          number: documentNumber,
          url: documentUrl,
          status: 'pending'
        };
        break;
      case 'pan':
        seller.documents.pan = {
          number: documentNumber,
          url: documentUrl,
          status: 'pending'
        };
        break;
      case 'aadhaar':
        seller.documents.aadhaar = {
          number: documentNumber,
          url: documentUrl,
          status: 'pending'
        };
        break;
      case 'other':
        if (!documentName) {
          return next(new AppError('Document name is required for other documents', 400));
        }
        seller.documents.others.push({
          name: documentName,
          type: documentType,
          url: documentUrl,
          status: 'pending'
        });
        break;
      default:
        return next(new AppError('Invalid document type', 400));
    }

    await seller.save();

    res.status(200).json({
      success: true,
      data: seller.documents
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Update store links
export const updateStoreLinks = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    const { storeLinks } = req.body;

    if (!storeLinks || typeof storeLinks !== 'object') {
      return next(new AppError('Store links data is required', 400));
    }

    // Update store links
    seller.storeLinks = {
      ...seller.storeLinks,
      ...storeLinks
    };

    await seller.save();

    res.status(200).json({
      success: true,
      data: seller,
      message: 'Store links updated successfully'
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Upload GST document to S3
export const uploadGstDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No document file provided', 400));
    }

    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return next(new AppError('Invalid file type. Only PDF, JPEG, and PNG files are allowed.', 400));
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      return next(new AppError('File size too large. Maximum size is 10MB.', 400));
    }

    try {
      // Delete old GST document from S3 if it exists
      if (seller.documents?.gstin?.url) {
        await deleteFromS3(seller.documents.gstin.url);
      }

      // Upload new document to S3
      const s3Key = `sellers/documents/gst/seller-${seller._id}-${Date.now()}${path.extname(req.file.originalname)}`;
      const documentUrl = await uploadToS3(req.file, s3Key);

      // Update seller with new GST document URL
      if (!seller.documents) {
        seller.documents = {};
      }
      seller.documents.gstin = {
        ...seller.documents.gstin,
        url: documentUrl,
        status: 'pending'
      };
      await seller.save();

      // Generate signed URL for immediate use in response
      const signedDocumentUrl = await generateSignedUrl(documentUrl);

      res.status(200).json({
        success: true,
        data: {
          message: 'GST document uploaded successfully',
          documentUrl: signedDocumentUrl,
          documentType: 'gst'
        }
      });

    } catch (uploadError) {
      console.error('S3 upload error:', uploadError);
      return next(new AppError('Failed to upload document to cloud storage', 500));
    }

  } catch (error) {
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(new AppError(error.message, 400));
  }
};

// Upload PAN document to S3
export const uploadPanDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No document file provided', 400));
    }

    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return next(new AppError('Invalid file type. Only PDF, JPEG, and PNG files are allowed.', 400));
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      return next(new AppError('File size too large. Maximum size is 10MB.', 400));
    }

    try {
      // Delete old PAN document from S3 if it exists
      if (seller.documents?.pan?.url) {
        await deleteFromS3(seller.documents.pan.url);
      }

      // Upload new document to S3
      const s3Key = `sellers/documents/pan/seller-${seller._id}-${Date.now()}${path.extname(req.file.originalname)}`;
      const documentUrl = await uploadToS3(req.file, s3Key);

      // Update seller with new PAN document URL
      if (!seller.documents) {
        seller.documents = {};
      }
      seller.documents.pan = {
        ...seller.documents.pan,
        url: documentUrl,
        status: 'pending'
      };
      await seller.save();

      // Generate signed URL for immediate use in response
      const signedDocumentUrl = await generateSignedUrl(documentUrl);

      res.status(200).json({
        success: true,
        data: {
          message: 'PAN document uploaded successfully',
          documentUrl: signedDocumentUrl,
          documentType: 'pan'
        }
      });

    } catch (uploadError) {
      console.error('S3 upload error:', uploadError);
      return next(new AppError('Failed to upload document to cloud storage', 500));
    }

  } catch (error) {
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(new AppError(error.message, 400));
  }
};

// Upload Aadhaar document to S3
export const uploadAadhaarDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No document file provided', 400));
    }

    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return next(new AppError('Invalid file type. Only PDF, JPEG, and PNG files are allowed.', 400));
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      return next(new AppError('File size too large. Maximum size is 10MB.', 400));
    }

    try {
      // Delete old Aadhaar document from S3 if it exists
      if (seller.documents?.aadhaar?.url) {
        await deleteFromS3(seller.documents.aadhaar.url);
      }

      // Upload new document to S3
      const s3Key = `sellers/documents/aadhaar/seller-${seller._id}-${Date.now()}${path.extname(req.file.originalname)}`;
      const documentUrl = await uploadToS3(req.file, s3Key);

      // Update seller with new Aadhaar document URL
      if (!seller.documents) {
        seller.documents = {};
      }
      seller.documents.aadhaar = {
        ...seller.documents.aadhaar,
        url: documentUrl,
        status: 'pending'
      };
      await seller.save();

      // Generate signed URL for immediate use in response
      const signedDocumentUrl = await generateSignedUrl(documentUrl);

      res.status(200).json({
        success: true,
        data: {
          message: 'Aadhaar document uploaded successfully',
          documentUrl: signedDocumentUrl,
          documentType: 'aadhaar'
        }
      });

    } catch (uploadError) {
      console.error('S3 upload error:', uploadError);
      return next(new AppError('Failed to upload document to cloud storage', 500));
    }

  } catch (error) {
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(new AppError(error.message, 400));
  }
};

// Upload cancelled cheque to S3
export const uploadCancelledCheque = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No document file provided', 400));
    }

    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return next(new AppError('Invalid file type. Only PDF, JPEG, and PNG files are allowed.', 400));
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      return next(new AppError('File size too large. Maximum size is 10MB.', 400));
    }

    try {
      // Delete old cancelled cheque from S3 if it exists
      if (seller.bankDetails?.cancelledCheque?.url) {
        await deleteFromS3(seller.bankDetails.cancelledCheque.url);
      }

      // Upload new document to S3
      const s3Key = `sellers/documents/cheque/seller-${seller._id}-${Date.now()}${path.extname(req.file.originalname)}`;
      const documentUrl = await uploadToS3(req.file, s3Key);

      // Update seller with new cancelled cheque URL
      if (!seller.bankDetails) {
        seller.bankDetails = {};
      }
      seller.bankDetails.cancelledCheque = {
        ...seller.bankDetails.cancelledCheque,
        url: documentUrl,
        status: 'pending'
      };
      await seller.save();

      // Generate signed URL for immediate use in response
      const signedDocumentUrl = await generateSignedUrl(documentUrl);

      res.status(200).json({
        success: true,
        data: {
          message: 'Cancelled cheque uploaded successfully',
          documentUrl: signedDocumentUrl,
          documentType: 'cancelled_cheque'
        }
      });

    } catch (uploadError) {
      console.error('S3 upload error:', uploadError);
      return next(new AppError('Failed to upload document to cloud storage', 500));
    }

  } catch (error) {
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(new AppError(error.message, 400));
  }
};

// Get document signed URL
export const getDocumentSignedUrl = async (req, res, next) => {
  try {
    const { documentType } = req.params;
    const seller = await Seller.findById(req.user.id);

    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    let documentUrl = null;

    // Get document URL based on type
    switch (documentType) {
      case 'gst':
        documentUrl = seller.documents?.gstin?.url;
        break;
      case 'pan':
        documentUrl = seller.documents?.pan?.url;
        break;
      case 'aadhaar':
        documentUrl = seller.documents?.aadhaar?.url;
        break;
      case 'cancelled_cheque':
        documentUrl = seller.bankDetails?.cancelledCheque?.url;
        break;
      default:
        return next(new AppError('Invalid document type', 400));
    }

    if (!documentUrl) {
      return next(new AppError(`No ${documentType} document found`, 404));
    }

    // Generate fresh signed URL
    const signedUrl = await generateSignedUrl(documentUrl);

    res.status(200).json({
      success: true,
      data: {
        documentUrl: signedUrl,
        documentType
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

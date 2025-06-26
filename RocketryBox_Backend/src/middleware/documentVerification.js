import { AppError } from './errorHandler.js';

/**
 * Get document upload status for a seller
 * @param {Object} seller - Seller object from database
 * @returns {Object} Document status information
 */
export const getDocumentUploadStatus = (seller) => {
  try {
    if (!seller) {
      return {
        documentsUploaded: false,
        adminVerified: false,
        completionPercentage: 0,
        missingDocuments: ['gstin', 'pan', 'aadhaar'],
        uploadedDocuments: [],
        status: 'pending_upload'
      };
    }

    const requiredDocuments = ['gstin', 'pan', 'aadhaar'];
    const uploadedDocuments = [];
    const missingDocuments = [];

    // Check each required document
    requiredDocuments.forEach(docType => {
      const document = seller.documents?.[docType];
      if (document && document.url && document.number) {
        uploadedDocuments.push(docType);
      } else {
        missingDocuments.push(docType);
      }
    });

    const uploadCompletionPercentage = Math.round((uploadedDocuments.length / requiredDocuments.length) * 100);
    const documentsUploaded = uploadedDocuments.length === requiredDocuments.length;

    // Check admin verification status
    const adminVerified = seller.kycVerified === true;

    // Determine overall status
    let status = 'pending_upload';
    if (documentsUploaded && adminVerified) {
      status = 'verified';
    } else if (documentsUploaded && !adminVerified) {
      status = 'pending_admin_verification';
    }

    return {
      documentsUploaded,
      adminVerified,
      completionPercentage: uploadCompletionPercentage,
      uploadedDocuments,
      missingDocuments,
      totalRequired: requiredDocuments.length,
      totalUploaded: uploadedDocuments.length,
      status,
      message: status === 'verified'
        ? 'All documents verified by admin'
        : status === 'pending_admin_verification'
          ? 'Documents uploaded. Awaiting admin verification.'
          : 'Please upload all required documents'
    };
  } catch (error) {
    console.error('Error getting document upload status:', error);
    return {
      documentsUploaded: false,
      adminVerified: false,
      completionPercentage: 0,
      missingDocuments: ['gstin', 'pan', 'aadhaar'],
      uploadedDocuments: [],
      status: 'pending_upload'
    };
  }
};

/**
 * Middleware to require basic profile completion
 */
export const requireBasicProfile = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return next(new AppError('Authentication required', 401));
    }

    // Allow Super Admins who are impersonating to bypass basic profile requirements
    if (user.isImpersonated && user.impersonatedBy) {
      console.log(`🔥 Super Admin impersonation detected - bypassing basic profile check for user: ${user.email}`);
      return next();
    }

    // Handle team users - they inherit profile status from parent seller
    if (user.role === 'team_user') {
      // Team users automatically pass basic profile check if they're active
      // since they can only be created by sellers who have completed profiles
      if (user.status === 'Active') {
        return next();
      } else {
        return next(new AppError('Your team account is not active. Please contact your admin.', 403));
      }
    }

    // Handle sellers - check their profile completion
    if (user.role === 'seller') {
      const hasBasicInfo = user.firstName && user.lastName && user.email && user.phone;
      const hasBusinessInfo = user.businessName;

      if (!hasBasicInfo || !hasBusinessInfo) {
        return next(new AppError('Please complete your basic profile information first', 403));
      }
    }

    next();
  } catch (error) {
    next(new AppError('Profile verification failed', 500));
  }
};

/**
 * Middleware to require admin-verified documents for critical business operations
 */
export const requireDocumentUpload = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return next(new AppError('Authentication required', 401));
    }

    // Allow Super Admins who are impersonating to bypass document verification requirements
    if (user.isImpersonated && user.impersonatedBy) {
      console.log(`🔥 Super Admin impersonation detected - bypassing document verification check for user: ${user.email}`);
      return next();
    }

    // Handle team users - they inherit document verification from parent seller
    if (user.role === 'team_user') {
      // Check if parent seller has verified documents
      if (user.seller && user.seller.status !== 'suspended') {
        // Get parent seller's document status
        const documentStatus = getDocumentUploadStatus(user.seller);

        if (!documentStatus.adminVerified) {
          return res.status(403).json({
            success: false,
            error: 'Parent seller verification required',
            message: 'Your parent seller account requires admin verification to access this feature.',
            data: {
              status: documentStatus.status,
              documentsUploaded: documentStatus.documentsUploaded,
              adminVerified: documentStatus.adminVerified,
              note: 'Contact your seller admin to complete document verification'
            }
          });
        }

        // Parent seller is verified, allow team user access
        return next();
      } else {
        return next(new AppError('Parent seller account not found or suspended', 403));
      }
    }

    // Handle sellers - check their own document verification
    if (user.role === 'seller') {
      const documentStatus = getDocumentUploadStatus(user);

      // Require both document upload AND admin verification for critical operations
      if (!documentStatus.adminVerified) {
        return res.status(403).json({
          success: false,
          error: 'Admin verification required',
          message: documentStatus.documentsUploaded
            ? 'Your documents are pending admin verification. Please wait for approval to access this feature.'
            : 'Please upload all required documents and wait for admin verification to access this feature.',
          data: {
            status: documentStatus.status,
            documentsUploaded: documentStatus.documentsUploaded,
            adminVerified: documentStatus.adminVerified,
            requiredDocuments: documentStatus.missingDocuments,
            completionPercentage: documentStatus.completionPercentage
          }
        });
      }
    }

    next();
  } catch (error) {
    next(new AppError('Document verification failed', 500));
  }
};

/**
 * Progressive document access middleware - allows access based on document upload percentage
 * (Note: This only checks upload completion, not admin verification)
 * @param {number} requiredPercentage - Minimum upload completion percentage required
 */
export const progressiveDocumentAccess = (requiredPercentage = 50) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return next(new AppError('Authentication required', 401));
      }

      // Allow Super Admins who are impersonating to bypass document upload requirements
      if (user.isImpersonated && user.impersonatedBy) {
        console.log(`🔥 Super Admin impersonation detected - bypassing document upload check (${requiredPercentage}%) for user: ${user.email}`);
        return next();
      }

      // Handle team users - they inherit document status from parent seller
      if (user.role === 'team_user') {
        // Check parent seller's document status
        if (user.seller && user.seller.status !== 'suspended') {
          const documentStatus = getDocumentUploadStatus(user.seller);

          if (documentStatus.completionPercentage < requiredPercentage) {
            return res.status(403).json({
              success: false,
              error: 'Parent seller document upload insufficient',
              message: `Parent seller needs to upload at least ${requiredPercentage}% of required documents`,
              data: {
                currentPercentage: documentStatus.completionPercentage,
                requiredPercentage,
                missingDocuments: documentStatus.missingDocuments,
                status: documentStatus.status,
                note: 'Contact your seller admin to complete document upload'
              }
            });
          }

          // Parent seller meets requirements, allow team user access
          return next();
        } else {
          return next(new AppError('Parent seller account not found or suspended', 403));
        }
      }

      // Handle sellers - check their own document status
      if (user.role === 'seller') {
        const documentStatus = getDocumentUploadStatus(user);

        if (documentStatus.completionPercentage < requiredPercentage) {
          return res.status(403).json({
            success: false,
            error: 'Insufficient document upload',
            message: `Please upload at least ${requiredPercentage}% of required documents to access this feature`,
            data: {
              currentPercentage: documentStatus.completionPercentage,
              requiredPercentage,
              missingDocuments: documentStatus.missingDocuments,
              status: documentStatus.status,
              note: 'Admin verification not required for this feature'
            }
          });
        }
      }

      next();
    } catch (error) {
      next(new AppError('Document verification failed', 500));
    }
  };
};

// Export alias for backward compatibility
export const checkDocumentUploadStatus = getDocumentUploadStatus;

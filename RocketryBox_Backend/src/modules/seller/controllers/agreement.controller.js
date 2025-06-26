import { AppError } from '../../../middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import Agreement from '../models/agreement.model.js';

/**
 * Get all agreements for the authenticated seller
 * @route GET /api/v2/seller/agreements
 * @access Private (Seller only)
 */
export const getSellerAgreements = async (req, res, next) => {
  try {
    const sellerId = req.user.id;

    logger.info(`Getting agreements for seller: ${sellerId}`);

    // Find all agreements for this seller
    const agreements = await Agreement.find({
      seller: sellerId,
      status: { $in: ['draft', 'active'] } // Only show active and draft agreements
    })
      .sort({ createdAt: -1 })
      .select('-__v');

    // Transform agreements to match frontend interface
    const transformedAgreements = agreements.map(agreement => ({
      version: agreement.version,
      docLink: agreement.documentUrl || `Agreement ${agreement.version}`,
      acceptanceDate: agreement.acceptedAt ? new Date(agreement.acceptedAt).toLocaleDateString() : '',
      publishedOn: new Date(agreement.effectiveDate).toLocaleDateString(),
      ipAddress: agreement.acceptedBy?.ipAddress || '',
      status: agreement.isAccepted() ? 'Accepted' :
        agreement.status === 'active' ? 'Pending' : 'Rejected',
      content: {
        serviceProvider: {
          name: 'RocketryBox Logistics Pvt Ltd',
          address: 'Tech Park, Electronic City, Bangalore, Karnataka, India',
          email: 'legal@rocketrybox.com'
        },
        merchant: {
          name: req.user.businessName || req.user.name,
          address: req.user.address ?
            `${req.user.address.street}, ${req.user.address.city}, ${req.user.address.state}, ${req.user.address.country}` :
            'Address not provided',
          email: req.user.email
        },
        merchantBusiness: req.user.companyCategory || 'General Business',
        serviceProviderBusiness: [
          'Courier Services',
          'Logistics Solutions',
          'Warehousing',
          'Last Mile Delivery',
          'Supply Chain Management'
        ]
      },
      _id: agreement._id // Include ID for operations
    }));

    res.status(200).json({
      success: true,
      data: transformedAgreements,
      message: 'Agreements fetched successfully'
    });

  } catch (error) {
    logger.error(`Error in getSellerAgreements: ${error.message}`);
    next(new AppError('Failed to fetch agreements', 500));
  }
};

/**
 * Accept an agreement
 * @route POST /api/v2/seller/agreements/:agreementId/accept
 * @access Private (Seller only)
 */
export const acceptAgreement = async (req, res, next) => {
  try {
    const { agreementId } = req.params;
    const sellerId = req.user.id;
    const userIP = req.ip || req.connection.remoteAddress;

    logger.info(`Seller ${sellerId} accepting agreement ${agreementId}`);

    // Find the agreement
    const agreement = await Agreement.findById(agreementId);

    if (!agreement) {
      return next(new AppError('Agreement not found', 404));
    }

    // Check if this agreement belongs to the seller
    if (agreement.seller.toString() !== sellerId) {
      return next(new AppError('You do not have permission to accept this agreement', 403));
    }

    // Check if already accepted
    if (agreement.isAccepted()) {
      return res.status(200).json({
        success: true,
        message: 'Agreement already accepted',
        data: { status: 'Accepted' }
      });
    }

    // Accept the agreement
    await agreement.accept({
      name: req.user.name,
      email: req.user.email,
      designation: 'Owner',
      ipAddress: userIP
    });

    logger.info(`Agreement ${agreementId} accepted by seller ${sellerId}`);

    res.status(200).json({
      success: true,
      message: 'Agreement accepted successfully',
      data: {
        agreementId,
        status: 'Accepted',
        acceptedAt: agreement.acceptedAt
      }
    });

  } catch (error) {
    logger.error(`Error in acceptAgreement: ${error.message}`);
    next(new AppError('Failed to accept agreement', 500));
  }
};

/**
 * Reject an agreement
 * @route POST /api/v2/seller/agreements/:agreementId/reject
 * @access Private (Seller only)
 */
export const rejectAgreement = async (req, res, next) => {
  try {
    const { agreementId } = req.params;
    const sellerId = req.user.id;

    logger.info(`Seller ${sellerId} rejecting agreement ${agreementId}`);

    // Find the agreement
    const agreement = await Agreement.findById(agreementId);

    if (!agreement) {
      return next(new AppError('Agreement not found', 404));
    }

    // Check if this agreement belongs to the seller
    if (agreement.seller.toString() !== sellerId) {
      return next(new AppError('You do not have permission to reject this agreement', 403));
    }

    // Update agreement status to inactive (rejected)
    agreement.status = 'inactive';
    agreement.updatedAt = new Date();
    await agreement.save();

    logger.info(`Agreement ${agreementId} rejected by seller ${sellerId}`);

    res.status(200).json({
      success: true,
      message: 'Agreement rejected',
      data: {
        agreementId,
        status: 'Rejected'
      }
    });

  } catch (error) {
    logger.error(`Error in rejectAgreement: ${error.message}`);
    next(new AppError('Failed to reject agreement', 500));
  }
};

/**
 * Download agreement document
 * @route GET /api/v2/seller/agreements/:agreementId/download
 * @access Private (Seller only)
 */
export const downloadAgreement = async (req, res, next) => {
  try {
    const { agreementId } = req.params;
    const sellerId = req.user.id;

    logger.info(`Seller ${sellerId} downloading agreement ${agreementId}`);

    // Find the agreement
    const agreement = await Agreement.findById(agreementId);

    if (!agreement) {
      return next(new AppError('Agreement not found', 404));
    }

    // Check if this agreement belongs to the seller
    if (agreement.seller.toString() !== sellerId) {
      return next(new AppError('You do not have permission to download this agreement', 403));
    }

    // For now, return the agreement content as a simple response
    // In a real implementation, you would generate/serve a PDF file
    const agreementContent = `
MERCHANT AGREEMENT

Agreement Version: ${agreement.version}
Effective Date: ${new Date(agreement.effectiveDate).toLocaleDateString()}

${agreement.content}

---
This is a legal document between RocketryBox Logistics Pvt Ltd and ${req.user.businessName || req.user.name}.
Generated on: ${new Date().toLocaleDateString()}
`;

    // Set headers for file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="agreement-${agreement.version}.pdf"`);

    // For demo purposes, return as text. In production, generate actual PDF
    res.status(200).send(agreementContent);

  } catch (error) {
    logger.error(`Error in downloadAgreement: ${error.message}`);
    next(new AppError('Failed to download agreement', 500));
  }
};

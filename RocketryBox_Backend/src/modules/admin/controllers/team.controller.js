import { AppError } from '../../../middleware/errorHandler.js';
import { sendEmail } from '../../../utils/email.js';
import { generateEmployeeId } from '../../../utils/employeeId.js';
import { uploadToS3 } from '../../../utils/fileUpload.js';
import { logger } from '../../../utils/logger.js';
import { generateOTP, storeOTP, verifyOTP } from '../../../utils/otp.js';
import { sendSMS } from '../../../utils/sms.js';
import Admin from '../models/admin.model.js';
import Session from '../models/session.model.js';

// Department-based permission mappings for Manager role
const MANAGER_DEPARTMENT_PERMISSIONS = {
  "Operations": {
    dashboardAccess: true,
    ordersShipping: true,
    shipmentTracking: true,
    deliveryAssignment: true,
    statusUpdates: true,
    // Restrictions: no financials, no customer financial data
    userManagement: false,
    financialOperations: false,
    systemConfig: false,
    teamManagement: false,
    sellerManagement: false,
    supportTickets: false,
    reportsAnalytics: true,
    marketingPromotions: false
  },
  "Customer Support": {
    dashboardAccess: true,
    supportTickets: true,
    customerCommunication: true,
    refundRequests: true,
    chatEmailLogs: true,
    // Restrictions: no shipment alteration, no bulk tools, no financial approvals
    ordersShipping: false,
    financialOperations: false,
    systemConfig: false,
    userManagement: false,
    teamManagement: false,
    sellerManagement: false,
    reportsAnalytics: true,
    marketingPromotions: false
  },
  "Sales & Business Development": {
    dashboardAccess: true,
    clientOnboarding: true,
    leadManagement: true,
    salesReports: true,
    businessDevelopment: true,
    sellerManagement: true,
    marketingPromotions: true,
    // Restrictions: no pricing approvals, no operational or financial access
    financialOperations: false,
    ordersShipping: false,
    systemConfig: false,
    userManagement: false,
    teamManagement: false,
    supportTickets: false,
    reportsAnalytics: true
  },
  "Accounts & Finance": {
    dashboardAccess: true,
    financialOperations: true,
    invoiceAccess: true,
    paymentLogs: true,
    payoutSummaries: true,
    reportsAnalytics: true,
    // Restrictions: cannot approve payments, no customer support tools
    supportTickets: false,
    ordersShipping: false,
    systemConfig: false,
    userManagement: false,
    teamManagement: false,
    sellerManagement: false,
    marketingPromotions: false
  },
  "Logistics Coordination": {
    dashboardAccess: true,
    pickupAssignment: true,
    logisticsTracking: true,
    dispatchScheduling: true,
    issueResolution: true,
    ordersShipping: true,
    reportsAnalytics: true,
    // Restrictions: no customer financial data, no customer support, no pricing
    financialOperations: false,
    supportTickets: false,
    systemConfig: false,
    userManagement: false,
    teamManagement: false,
    sellerManagement: false,
    marketingPromotions: false
  },
  "Warehouse Management": {
    dashboardAccess: true,
    warehouseOperations: true,
    inventoryTracking: true,
    packingStatus: true,
    storageManagement: true,
    ordersShipping: true,
    reportsAnalytics: true,
    // Restrictions: no customer interaction, no external logistics, no financial/sales
    supportTickets: false,
    financialOperations: false,
    sellerManagement: false,
    systemConfig: false,
    userManagement: false,
    teamManagement: false,
    marketingPromotions: false
  },
  "IT Support": {
    dashboardAccess: true,
    systemLogs: true,
    technicalSupport: true,
    userCredentials: true,
    systemAlerts: true,
    systemConfig: true,
    // Restrictions: no sales/finance data, no admin-level access
    financialOperations: false,
    sellerManagement: false,
    supportTickets: false,
    userManagement: false,
    teamManagement: false,
    ordersShipping: false,
    reportsAnalytics: true,
    marketingPromotions: false
  }
};

/**
 * Generate department-based permissions for Manager role
 * @param {string} department - The selected department
 * @returns {object} - Permission object with boolean values
 */
const generateManagerPermissions = (department) => {
  // Default base permissions for all managers
  const basePermissions = {
    dashboardAccess: true,
    userManagement: false,
    teamManagement: false,
    ordersShipping: false,
    financialOperations: false,
    systemConfig: false,
    sellerManagement: false,
    supportTickets: false,
    reportsAnalytics: false,
    marketingPromotions: false
  };

  // Apply department-specific permissions
  if (MANAGER_DEPARTMENT_PERMISSIONS[department]) {
    const deptPermissions = MANAGER_DEPARTMENT_PERMISSIONS[department];

    // Override base permissions with department-specific ones
    Object.keys(deptPermissions).forEach(permission => {
      if (permission in basePermissions) {
        basePermissions[permission] = deptPermissions[permission];
      }
    });

    logger.info(`✅ Generated Manager permissions for ${department}:`, basePermissions);
  } else {
    logger.warn(`⚠️ Unknown department for Manager: ${department}. Using base permissions.`);
  }

  return basePermissions;
};

/**
 * Get all team members with pagination and filters
 * @route GET /api/v2/admin/team
 * @access Private (Admin only)
 */
export const getAllTeamMembers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      status,
      department,
      sortField = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Add filters if provided
    if (role) query.role = role;
    if (status) query.status = status;
    if (department) query.department = department;

    // Add search filter if provided
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }

    // Sorting
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const sortOptions = { [sortField]: sortDirection };

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const countPromise = Admin.countDocuments(query);
    const teamsPromise = Admin.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-password');

    // Execute both promises simultaneously
    const [total, teamMembers] = await Promise.all([countPromise, teamsPromise]);

    // Transform team member data for frontend
    const transformedTeamMembers = teamMembers.map(transformTeamMemberData);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: {
        teamMembers: transformedTeamMembers,
        pagination: {
          current: parseInt(page),
          total: totalPages,
          hasNext: hasNextPage,
          hasPrev: hasPrevPage,
          limit: parseInt(limit),
          totalCount: total
        }
      }
    });
  } catch (error) {
    logger.error(`Error in getAllTeamMembers: ${error.message}`);
    next(new AppError('Failed to fetch team members', 500));
  }
};

/**
 * Get team member details by ID
 * @route GET /api/v2/admin/team/:userId
 * @access Private (Admin only)
 */
export const getTeamMemberDetails = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const teamMember = await Admin.findById(userId).select('-password');

    if (!teamMember) {
      return next(new AppError('Team member not found', 404));
    }

    // Transform data for frontend consumption
    const transformedData = transformTeamMemberData(teamMember);

    res.status(200).json({
      success: true,
      data: transformedData
    });
  } catch (error) {
    logger.error(`Error in getTeamMemberDetails: ${error.message}`);
    next(new AppError('Failed to fetch team member details', 500));
  }
};

/**
 * Get detailed admin profile with activity history
 * @route GET /api/v2/admin/team/:userId/profile
 * @access Private (Admin only)
 */
export const getTeamMemberProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Find team member with populated references
    const teamMember = await Admin.findById(userId)
      .select('-password')
      .populate({
        path: 'statusHistory.updatedBy',
        select: 'fullName email role'
      })
      .populate({
        path: 'permissionHistory.updatedBy',
        select: 'fullName email role'
      });

    if (!teamMember) {
      return next(new AppError('Team member not found', 404));
    }

    // Get recent login sessions
    const sessions = await Session.find({
      adminId: userId,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('deviceInfo ipAddress createdAt lastActive isActive');

    // Get recent actions from logs (would need a proper audit log system)
    // This is a placeholder - in a real system, you would query your audit logs
    // const recentActions = await AuditLog.find({ adminId: userId })
    //   .sort({ timestamp: -1 })
    //   .limit(20);

    const profile = {
      basicInfo: {
        id: teamMember._id,
        fullName: teamMember.fullName,
        email: teamMember.email,
        phoneNumber: teamMember.phoneNumber,
        role: teamMember.role,
        department: teamMember.department,
        designation: teamMember.designation,
        status: teamMember.status,
        isSuperAdmin: teamMember.isSuperAdmin,
        employeeId: teamMember.employeeId,
        dateOfJoining: teamMember.dateOfJoining,
        createdAt: teamMember.createdAt
      },
      permissions: teamMember.permissions,
      history: {
        status: teamMember.statusHistory || [],
        permissions: teamMember.permissionHistory || []
      },
      sessions: sessions,
      // recentActions: recentActions || []
    };

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error(`Error in getTeamMemberProfile: ${error.message}`);
    next(new AppError('Failed to fetch team member profile', 500));
  }
};

/**
 * Update team member
 * @route PATCH /api/v2/admin/team/:userId
 * @access Private (Admin only)
 */
export const updateTeamMember = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const {
      fullName,
      employeeId,
      email,
      phoneNumber,
      address,
      role,
      status,
      remarks,
      department,
      designation,
      // Financial & Identity Information
      aadharNumber,
      panNumber,
      bankAccountNumber,
      ifscCode,
      bankName,
      accountHolderName
    } = req.body;

    // Find team member
    const teamMember = await Admin.findById(userId);

    if (!teamMember) {
      return next(new AppError('Team member not found', 404));
    }

    // Check if email is being changed and already exists
    if (email && email !== teamMember.email) {
      const existingEmail = await Admin.findOne({ email });
      if (existingEmail) {
        return next(new AppError('Email already in use', 400));
      }
    }

    // Check if employeeId is being changed and already exists
    if (employeeId && employeeId !== teamMember.employeeId) {
      const existingEmployeeId = await Admin.findOne({ employeeId });
      if (existingEmployeeId) {
        return next(new AppError('Employee ID already in use', 400));
      }
    }

    // Update basic fields
    if (fullName) teamMember.fullName = fullName;
    if (employeeId) teamMember.employeeId = employeeId;
    if (email) teamMember.email = email;
    if (phoneNumber) teamMember.phoneNumber = phoneNumber;
    if (address) teamMember.address = address;
    if (role) teamMember.role = role;
    if (status) teamMember.status = status;
    if (remarks) teamMember.remarks = remarks;
    if (department) teamMember.department = department;
    if (designation) teamMember.designation = designation;

    // Update financial information
    if (aadharNumber !== undefined || panNumber !== undefined ||
      bankAccountNumber !== undefined || ifscCode !== undefined ||
      bankName !== undefined || accountHolderName !== undefined) {

      // Initialize financialDetails if it doesn't exist
      if (!teamMember.financialDetails) {
        teamMember.financialDetails = {};
      }

      // Initialize bankDetails if it doesn't exist
      if (!teamMember.financialDetails.bankDetails) {
        teamMember.financialDetails.bankDetails = {};
      }

      // Update financial fields
      if (aadharNumber !== undefined) {
        teamMember.financialDetails.aadharNumber = aadharNumber;
      }
      if (panNumber !== undefined) {
        teamMember.financialDetails.panNumber = panNumber;
      }

      // Update bank details
      if (bankAccountNumber !== undefined) {
        teamMember.financialDetails.bankDetails.accountNumber = bankAccountNumber;
      }
      if (ifscCode !== undefined) {
        teamMember.financialDetails.bankDetails.ifscCode = ifscCode;
      }
      if (bankName !== undefined) {
        teamMember.financialDetails.bankDetails.bankName = bankName;
      }
      if (accountHolderName !== undefined) {
        teamMember.financialDetails.bankDetails.accountHolderName = accountHolderName;
      }

      // Mark the nested object as modified for Mongoose
      teamMember.markModified('financialDetails');
    }

    // Save updated team member
    await teamMember.save();

    // Transform the response data for frontend
    const transformedData = transformTeamMemberData(teamMember);

    // Log the update
    logger.info(`Admin ${req.user.id} updated team member ${userId}`);

    res.status(200).json({
      success: true,
      data: transformedData,
      message: 'Team member updated successfully'
    });
  } catch (error) {
    logger.error(`Error in updateTeamMember: ${error.message}`);
    next(new AppError('Failed to update team member', 500));
  }
};

/**
 * Update team member status
 * @route PATCH /api/v2/admin/team/:userId/status
 * @access Private (Admin only)
 */
export const updateTeamMemberStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    if (!['Active', 'Inactive', 'On Leave'].includes(status)) {
      return next(new AppError('Invalid status', 400));
    }

    const teamMember = await Admin.findById(userId);

    if (!teamMember) {
      return next(new AppError('Team member not found', 404));
    }

    // Update status
    teamMember.status = status;

    // Add status change to history (if model has this field)
    if (teamMember.statusHistory) {
      teamMember.statusHistory.push({
        status,
        reason,
        updatedBy: req.user.id,
        timestamp: new Date()
      });
    }

    await teamMember.save();

    // Log the status update
    logger.info(`Admin ${req.user.id} updated team member ${userId} status to ${status}`);

    res.status(200).json({
      success: true,
      data: {
        userId,
        status,
        message: 'Team member status updated successfully'
      }
    });
  } catch (error) {
    logger.error(`Error in updateTeamMemberStatus: ${error.message}`);
    next(new AppError('Failed to update team member status', 500));
  }
};

/**
 * Update team member permissions
 * @route PATCH /api/v2/admin/team/:userId/permissions
 * @access Private (Admin only)
 */
export const updateTeamMemberPermissions = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;

    // Validate permissions object
    if (!permissions || typeof permissions !== 'object') {
      return next(new AppError('Invalid permissions format', 400));
    }

    // Find team member
    const teamMember = await Admin.findById(userId);

    if (!teamMember) {
      return next(new AppError('Team member not found', 404));
    }

    // Only super admins can modify other super admin permissions
    if (teamMember.isSuperAdmin && !req.user.isSuperAdmin) {
      return next(new AppError('You do not have permission to modify a super admin\'s permissions', 403));
    }

    // Check if the user is trying to modify their own permissions
    if (userId === req.user.id && !req.user.isSuperAdmin) {
      return next(new AppError('You cannot modify your own permissions', 403));
    }

    // Get previous permissions for audit log
    const previousPermissions = { ...teamMember.permissions };

    // Track which permissions were changed
    const changedPermissions = {};

    // Define valid sections - Updated to include all navigation permissions
    const validSections = [
      // Core Access
      'dashboardAccess',

      // Navigation Permissions - All Sidebar Items
      'usersAccess',
      'teamsAccess',
      'partnersAccess',
      'ordersAccess',
      'shipmentsAccess',
      'ticketsAccess',
      'ndrAccess',
      'billingAccess',
      'reportsAccess',
      'escalationAccess',
      'settingsAccess',

      // Granular Operation Permissions
      'userManagement',
      'teamManagement',
      'ordersShipping',
      'financialOperations',
      'systemConfig',
      'sellerManagement',
      'supportTickets',
      'reportsAnalytics',
      'marketingPromotions'
    ];

    // Update permissions with validation
    validSections.forEach(section => {
      if (permissions.hasOwnProperty(section) && typeof permissions[section] === 'boolean') {
        // If the permission has changed, record it
        if (teamMember.permissions[section] !== permissions[section]) {
          changedPermissions[section] = {
            from: teamMember.permissions[section],
            to: permissions[section]
          };
        }
        teamMember.permissions[section] = permissions[section];
      }
    });

    // Create permission change history entry
    if (!teamMember.permissionHistory) {
      teamMember.permissionHistory = [];
    }

    // Only add history entry if permissions were actually changed
    if (Object.keys(changedPermissions).length > 0) {
      teamMember.permissionHistory.push({
        updatedBy: req.user.id,
        timestamp: new Date(),
        changes: changedPermissions,
        reason: req.body.reason || 'Permission update'
      });
    }

    // Save updated team member
    await teamMember.save();

    // Log the permissions update
    logger.info(`Admin ${req.user.id} updated permissions for team member ${userId}`, {
      changes: changedPermissions,
      reason: req.body.reason || 'Permission update'
    });

    res.status(200).json({
      success: true,
      data: teamMember.permissions,
      message: 'Team member permissions updated successfully'
    });
  } catch (error) {
    logger.error(`Error in updateTeamMemberPermissions: ${error.message}`);
    next(new AppError('Failed to update team member permissions', 500));
  }
};

/**
 * Upload team member documents
 * @route POST /api/v2/admin/team/:userId/documents
 * @access Private (Admin only)
 */
export const uploadTeamMemberDocuments = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { type: documentType } = req.body;

    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    // Updated document types to match the new schema
    const validDocumentTypes = ['aadharDocument', 'panDocument', 'bankPassbookDocument', 'idProof', 'employmentContract'];

    if (!documentType || !validDocumentTypes.includes(documentType)) {
      return next(new AppError(`Invalid document type. Must be one of: ${validDocumentTypes.join(', ')}`, 400));
    }

    const teamMember = await Admin.findById(userId);

    if (!teamMember) {
      return next(new AppError('Team member not found', 404));
    }

    // Upload file to S3 or store locally
    let fileUrl;
    try {
      fileUrl = await uploadToS3(req.file, `admin-documents/${userId}/${documentType}`);
    } catch (uploadError) {
      logger.error(`File upload failed: ${uploadError.message}`);
      // Fallback to local storage path
      fileUrl = req.file.path;
    }

    // Initialize documents object if it doesn't exist
    if (!teamMember.documents) {
      teamMember.documents = {};
    }

    // Handle different document types appropriately
    if (['aadharDocument', 'panDocument', 'bankPassbookDocument'].includes(documentType)) {
      // For new document types, store as string path
      teamMember.documents[documentType] = fileUrl;
    } else {
      // For legacy document types, store as object with name and url
      teamMember.documents[documentType] = {
        name: req.file.originalname,
        url: fileUrl
      };
    }

    // Mark the documents object as modified for Mongoose
    teamMember.markModified('documents');

    await teamMember.save();

    // Log the document upload
    logger.info(`Admin ${req.user.id} uploaded ${documentType} for team member ${userId}`);

    res.status(200).json({
      success: true,
      data: {
        documentType,
        name: req.file.originalname,
        url: fileUrl,
        message: 'Document uploaded successfully'
      }
    });
  } catch (error) {
    logger.error(`Error in uploadTeamMemberDocuments: ${error.message}`);
    next(new AppError('Failed to upload document', 500));
  }
};

/**
 * Register a new team member
 * @route POST /api/v2/admin/team/register
 * @access Private (Admin only)
 */
export const registerTeamMember = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      role,
      department,
      phoneNumber,
      address,
      dateOfJoining,
      employeeId,
      designation,
      remarks,
      password, // Use user-provided password
      status = 'Active',
      sendInvitation = true,
      // Financial & Identity Information
      aadharNumber,
      panNumber,
      bankAccountNumber,
      ifscCode,
      bankName,
      accountHolderName,
      // Super Admin privileges
      isSuperAdmin = false
    } = req.body;

    // Explicitly validate and convert isSuperAdmin to boolean
    const actualIsSuperAdmin = String(isSuperAdmin).toLowerCase() === 'true';

    // Log the Super Admin processing for debugging
    logger.info(`Super Admin Processing for ${email}:`, {
      received_isSuperAdmin: isSuperAdmin,
      typeof_received: typeof isSuperAdmin,
      converted_to_boolean: actualIsSuperAdmin,
      role_provided: role,
      department_provided: department
    });

    // Validate required fields
    if (!fullName || !email || !phoneNumber) {
      return next(new AppError('Missing required fields: fullName, email, phoneNumber', 400));
    }

    // For non-Super Admin users, role and department are required
    if (!actualIsSuperAdmin && (!role || !department)) {
      return next(new AppError('Role and Department are required for non-Super Admin users', 400));
    }

    // For Super Admin users, set default role and department if not provided
    const finalRole = actualIsSuperAdmin ? (role || 'Admin') : role;
    const finalDepartment = actualIsSuperAdmin ? (department || 'Administration') : department;

    // Generate permissions based on role and department
    let permissions = {};

    if (actualIsSuperAdmin) {
      // Super Admin gets all permissions
      permissions = {
        dashboardAccess: true,
        userManagement: true,
        teamManagement: true,
        ordersShipping: true,
        financialOperations: true,
        systemConfig: true,
        sellerManagement: true,
        supportTickets: true,
        reportsAnalytics: true,
        marketingPromotions: true
      };
      logger.info('🔥 Super Admin permissions granted - ALL ACCESS');
    } else if (finalRole === 'Manager' && finalDepartment) {
      // Manager gets department-specific permissions
      permissions = generateManagerPermissions(finalDepartment);
      logger.info(`🎯 Manager permissions generated for ${finalDepartment} department`);
    } else {
      // Default permissions for other roles
      switch (finalRole) {
        case 'Admin':
          permissions = {
            dashboardAccess: true,
            userManagement: true,
            teamManagement: true,
            ordersShipping: true,
            financialOperations: true,
            systemConfig: false, // Regular admins can't change system config
            sellerManagement: true,
            supportTickets: true,
            reportsAnalytics: true,
            marketingPromotions: true
          };
          break;
        case 'Support':
          permissions = {
            dashboardAccess: true,
            supportTickets: true,
            userManagement: false,
            teamManagement: false,
            ordersShipping: true,
            financialOperations: false,
            systemConfig: false,
            sellerManagement: false,
            reportsAnalytics: false,
            marketingPromotions: false
          };
          break;
        case 'Agent':
          permissions = {
            dashboardAccess: true,
            supportTickets: true,
            userManagement: false,
            teamManagement: false,
            ordersShipping: false,
            financialOperations: false,
            systemConfig: false,
            sellerManagement: false,
            reportsAnalytics: false,
            marketingPromotions: false
          };
          break;
        default:
          permissions = {
            dashboardAccess: true,
            userManagement: false,
            teamManagement: false,
            ordersShipping: false,
            financialOperations: false,
            systemConfig: false,
            sellerManagement: false,
            supportTickets: false,
            reportsAnalytics: false,
            marketingPromotions: false
          };
      }
      logger.info(`📋 Standard permissions assigned for role: ${finalRole}`);
    }

    // Log the permission assignment for debugging
    logger.info(`🔐 Permission Summary for ${email}:`, {
      role: finalRole,
      department: finalDepartment,
      isSuperAdmin: actualIsSuperAdmin,
      grantedPermissions: Object.keys(permissions).filter(p => permissions[p])
    });

    // Validate password if provided
    if (!password || password.length < 8) {
      return next(new AppError('Password must be at least 8 characters long', 400));
    }

    // Check if email already exists
    const existingEmail = await Admin.findOne({ email });
    if (existingEmail) {
      return next(new AppError('Email already in use', 400));
    }

    // Generate employee ID if not provided
    let finalEmployeeId = employeeId;
    if (!finalEmployeeId) {
      finalEmployeeId = await generateEmployeeId(finalDepartment);
    } else {
      // Check if provided employee ID already exists
      const existingEmployeeId = await Admin.findOne({ employeeId: finalEmployeeId });
      if (existingEmployeeId) {
        return next(new AppError('Employee ID already in use', 400));
      }
    }

    // Handle file uploads to S3
    const documents = {};
    let profileImagePath = null;

    if (req.files) {
      logger.info('Processing file uploads for team member registration', {
        profilePhoto: !!req.files.profilePhoto,
        aadharDocument: !!req.files.aadharDocument,
        panDocument: !!req.files.panDocument,
        bankPassbookDocument: !!req.files.bankPassbookDocument
      });

      // Log S3 configuration status
      const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME;
      logger.info('S3 Configuration Check for admin registration:', {
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        bucketName: bucketName || 'NOT SET',
        AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME || 'NOT SET',
        S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'NOT SET',
        region: process.env.AWS_REGION || 'NOT SET',
        s3ConfigComplete: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && bucketName)
      });

      // Handle profile photo upload to S3
      if (req.files.profilePhoto) {
        try {
          const profileFile = req.files.profilePhoto[0];
          logger.info('Starting profile photo S3 upload', {
            originalname: profileFile.originalname,
            size: profileFile.size,
            mimetype: profileFile.mimetype,
            path: profileFile.path,
            s3Key: `admin-profiles/${finalEmployeeId}/profile-photo`
          });

          profileImagePath = await uploadToS3(profileFile, `admin-profiles/${finalEmployeeId}/profile-photo`);

          logger.info(`✅ Profile photo uploaded to S3 successfully!`, {
            s3Url: profileImagePath,
            isS3Upload: profileImagePath.startsWith('http'),
            employeeId: finalEmployeeId
          });
        } catch (uploadError) {
          logger.error(`❌ Profile photo S3 upload failed:`, {
            error: uploadError.message,
            stack: uploadError.stack,
            employeeId: finalEmployeeId
          });
          // Fallback to local storage path
          profileImagePath = req.files.profilePhoto[0].path;
          logger.warn(`⚠️ Using local storage fallback for profile photo: ${profileImagePath}`);
        }
      }

      // Handle document uploads to S3
      if (req.files.aadharDocument) {
        try {
          const aadharFile = req.files.aadharDocument[0];
          logger.info('Starting Aadhar document S3 upload', {
            originalname: aadharFile.originalname,
            size: aadharFile.size,
            s3Key: `admin-documents/${finalEmployeeId}/aadhar-document`
          });

          documents.aadharDocument = await uploadToS3(aadharFile, `admin-documents/${finalEmployeeId}/aadhar-document`);

          logger.info(`✅ Aadhar document uploaded to S3: ${documents.aadharDocument}`, {
            isS3Upload: documents.aadharDocument.startsWith('http')
          });
        } catch (uploadError) {
          logger.error(`❌ Aadhar document S3 upload failed:`, {
            error: uploadError.message,
            stack: uploadError.stack
          });
          // Fallback to local storage path
          documents.aadharDocument = req.files.aadharDocument[0].path;
          logger.warn(`⚠️ Using local storage fallback for Aadhar: ${documents.aadharDocument}`);
        }
      }

      if (req.files.panDocument) {
        try {
          const panFile = req.files.panDocument[0];
          logger.info('Starting PAN document S3 upload', {
            originalname: panFile.originalname,
            size: panFile.size,
            s3Key: `admin-documents/${finalEmployeeId}/pan-document`
          });

          documents.panDocument = await uploadToS3(panFile, `admin-documents/${finalEmployeeId}/pan-document`);

          logger.info(`✅ PAN document uploaded to S3: ${documents.panDocument}`, {
            isS3Upload: documents.panDocument.startsWith('http')
          });
        } catch (uploadError) {
          logger.error(`❌ PAN document S3 upload failed:`, {
            error: uploadError.message,
            stack: uploadError.stack
          });
          // Fallback to local storage path
          documents.panDocument = req.files.panDocument[0].path;
          logger.warn(`⚠️ Using local storage fallback for PAN: ${documents.panDocument}`);
        }
      }

      if (req.files.bankPassbookDocument) {
        try {
          const bankFile = req.files.bankPassbookDocument[0];
          logger.info('Starting Bank passbook document S3 upload', {
            originalname: bankFile.originalname,
            size: bankFile.size,
            s3Key: `admin-documents/${finalEmployeeId}/bank-passbook-document`
          });

          documents.bankPassbookDocument = await uploadToS3(bankFile, `admin-documents/${finalEmployeeId}/bank-passbook-document`);

          logger.info(`✅ Bank passbook document uploaded to S3: ${documents.bankPassbookDocument}`, {
            isS3Upload: documents.bankPassbookDocument.startsWith('http')
          });
        } catch (uploadError) {
          logger.error(`❌ Bank passbook document S3 upload failed:`, {
            error: uploadError.message,
            stack: uploadError.stack
          });
          // Fallback to local storage path
          documents.bankPassbookDocument = req.files.bankPassbookDocument[0].path;
          logger.warn(`⚠️ Using local storage fallback for Bank passbook: ${documents.bankPassbookDocument}`);
        }
      }

      logger.info('File uploads completed for team member registration', {
        profileImageUploaded: !!profileImagePath,
        documentsUploaded: Object.keys(documents).length,
        finalEmployeeId
      });
    }

    // Create new team member with user-provided password and additional fields
    const newTeamMember = await Admin.create({
      fullName,
      email,
      role: finalRole,
      department: finalDepartment,
      phoneNumber,
      address,
      dateOfJoining: dateOfJoining || Date.now(),
      employeeId: finalEmployeeId,
      designation,
      status,
      remarks,
      password, // Use the user-provided password directly
      profileImage: profileImagePath,
      // Permission assignment based on role and department
      permissions,
      // Financial & Identity Information
      financialDetails: {
        aadharNumber,
        panNumber,
        bankDetails: {
          accountNumber: bankAccountNumber,
          ifscCode,
          bankName,
          accountHolderName
        }
      },
      // Document paths
      documents,
      // Super Admin privileges
      isSuperAdmin: actualIsSuperAdmin
    });

    // Generate OTP for verification (optional for immediate login)
    const otp = generateOTP(6);

    // Store OTP in Redis with team member's email as key
    await storeOTP(email, otp, 30 * 60); // 30 minutes expiry

    // Send invitation email with login credentials if requested
    if (sendInvitation) {
      try {
        await sendEmail({
          to: email,
          templateId: 'admin-invitation',
          variables: {
            name: fullName,
            email: email,
            role: actualIsSuperAdmin ? `${finalRole} (SUPER ADMIN)` : finalRole,
            department: finalDepartment,
            employeeId: finalEmployeeId,
            password, // Use the actual password provided by admin
            loginUrl: `${process.env.ADMIN_FRONTEND_URL}/admin/login`,
            otp,
            verificationLink: `${process.env.ADMIN_FRONTEND_URL}/admin/verify?email=${encodeURIComponent(email)}&otp=${otp}`,
            adminPortalUrl: process.env.ADMIN_FRONTEND_URL || 'https://admin.rocketrybox.com',
            platformName: 'RocketryBox Admin',
            isSuperAdmin: actualIsSuperAdmin
          }
        });

        // Log what type of email was sent for debugging
        logger.info(`Email sent to ${email}:`, {
          emailType: actualIsSuperAdmin ? 'Super Admin Invitation' :
            (finalRole === 'Manager' ? `Manager Invitation (${finalDepartment})` : 'Regular Admin Invitation'),
          role: finalRole,
          department: finalDepartment,
          isSuperAdmin: actualIsSuperAdmin,
          permissionsGranted: Object.keys(permissions).filter(p => permissions[p]).length
        });

        // Also send SMS notification if phone number is provided
        if (phoneNumber) {
          try {
            await sendSMS({
              to: phoneNumber,
              type: 'log', // Use account activation template
              variables: `${finalEmployeeId}|Welcome to RocketryBox Admin` // Employee ID and welcome message
            });
          } catch (smsError) {
            logger.error(`Failed to send SMS: ${smsError.message}`);
            // Continue even if SMS fails - email is more important
          }
        }

        logger.info(`Welcome email sent to new team member: ${email}`);
      } catch (emailError) {
        logger.error(`Failed to send invitation email: ${emailError.message}`);
        // Continue with the registration even if email fails, but log the error
      }
    }

    // Remove password from response for security
    newTeamMember.password = undefined;

    // Log the creation with Super Admin status
    const logMessage = `Admin ${req.user.id} registered new team member ${newTeamMember._id} with employee ID ${finalEmployeeId}${actualIsSuperAdmin ? ' (SUPER ADMIN PRIVILEGES GRANTED)' : ''}`;
    logger.info(logMessage);

    // Enhanced success message with file upload details
    const uploadDetails = {
      profilePhoto: !!profileImagePath,
      documents: Object.keys(documents).length,
      isS3Upload: profileImagePath?.startsWith('http') || Object.values(documents).some(path => path?.startsWith('http'))
    };

    const fileUploadMessage = uploadDetails.profilePhoto || uploadDetails.documents > 0
      ? ` Files uploaded to ${uploadDetails.isS3Upload ? 'S3 cloud storage' : 'local storage'} successfully.`
      : '';

    const baseMessage = sendInvitation
      ? `User created successfully. Welcome email sent to ${email} with login credentials.${fileUploadMessage}`
      : `User created successfully.${fileUploadMessage}`;

    const roleSpecificMessage = actualIsSuperAdmin
      ? ' ⚡ SUPER ADMIN PRIVILEGES GRANTED - User has maximum system access.'
      : finalRole === 'Manager'
        ? ` 🎯 MANAGER PERMISSIONS GRANTED for ${finalDepartment} department with specialized access rights.`
        : '';

    // Log file upload summary
    logger.info(`File upload summary for ${email}:`, uploadDetails);

    res.status(201).json({
      success: true,
      data: {
        teamMember: newTeamMember,
        message: baseMessage + roleSpecificMessage,
        permissions: {
          role: finalRole,
          department: finalDepartment,
          isSuperAdmin: actualIsSuperAdmin,
          grantedPermissions: Object.keys(permissions).filter(p => permissions[p])
        }
      }
    });
  } catch (error) {
    logger.error(`Error in registerTeamMember: ${error.message}`);
    next(new AppError('Failed to create user', 500));
  }
};

/**
 * Verify team member email/phone with OTP
 * @route POST /api/v2/admin/team/verify
 * @access Public
 */
export const verifyTeamMember = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return next(new AppError('Email and OTP are required', 400));
    }

    // Verify OTP stored in Redis
    const isValid = await verifyOTP(email, otp);

    if (!isValid) {
      return next(new AppError('Invalid or expired OTP', 400));
    }

    // Find the team member
    const teamMember = await Admin.findOne({ email });

    if (!teamMember) {
      return next(new AppError('Team member not found', 404));
    }

    // Update verification status if needed
    // You might want to add a verification field to the model

    // Log the verification
    logger.info(`Team member ${teamMember._id} verified email with OTP`);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    logger.error(`Error in verifyTeamMember: ${error.message}`);
    next(new AppError('Verification failed', 500));
  }
};

/**
 * Reset team member password
 * @route POST /api/v2/admin/team/reset-password
 * @access Public (with OTP verification)
 */
export const resetTeamMemberPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return next(new AppError('Email, OTP and new password are required', 400));
    }

    // Verify OTP stored in Redis
    const isValid = await verifyOTP(email, otp);

    if (!isValid) {
      return next(new AppError('Invalid or expired OTP', 400));
    }

    // Find the team member
    const teamMember = await Admin.findOne({ email });

    if (!teamMember) {
      return next(new AppError('Team member not found', 404));
    }

    // Update password
    teamMember.password = newPassword;
    await teamMember.save();

    // Log the password reset
    logger.info(`Team member ${teamMember._id} reset password`);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    logger.error(`Error in resetTeamMemberPassword: ${error.message}`);
    next(new AppError('Password reset failed', 500));
  }
};

/**
 * Request password reset OTP
 * @route POST /api/v2/admin/team/forgot-password
 * @access Public
 */
export const forgotTeamMemberPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new AppError('Email is required', 400));
    }

    // Find the team member
    const teamMember = await Admin.findOne({ email });

    if (!teamMember) {
      return next(new AppError('Team member not found', 404));
    }

    // Generate OTP for verification
    const otp = generateOTP(6);

    // Store OTP in Redis with team member's email as key
    await storeOTP(email, otp, 15 * 60); // 15 minutes expiry

    // Send email with OTP
    try {
      await sendEmail({
        to: email,
        templateId: 'password-reset',
        variables: {
          name: teamMember.fullName,
          otp,
          resetLink: `${process.env.ADMIN_FRONTEND_URL}/reset-password?email=${encodeURIComponent(email)}&otp=${otp}`
        }
      });

      // Also send OTP via SMS if phone number is available
      if (teamMember.phoneNumber) {
        try {
          await sendSMS({
            to: teamMember.phoneNumber,
            type: 'otp',
            variables: `Password Reset|${otp}|15` // context|otp|minutes
          });
        } catch (smsError) {
          logger.error(`Failed to send password reset SMS: ${smsError.message}`);
          // Continue even if SMS fails
        }
      }
    } catch (emailError) {
      logger.error(`Failed to send password reset email: ${emailError.message}`);
      return next(new AppError('Failed to send password reset email', 500));
    }

    // Log the request
    logger.info(`Password reset requested for team member ${teamMember._id}`);

    res.status(200).json({
      success: true,
      message: 'Password reset OTP sent to your email and phone'
    });
  } catch (error) {
    logger.error(`Error in forgotTeamMemberPassword: ${error.message}`);
    next(new AppError('Failed to request password reset', 500));
  }
};

/**
 * Get system sections and access statistics
 * @route GET /api/v2/admin/team/sections
 * @access Private (Admin only)
 */
export const getSystemSections = async (req, res, next) => {
  try {
    // Define system sections with descriptions
    const systemSections = [
      {
        id: 'dashboardAccess',
        name: 'Dashboard Access',
        description: 'Access to view dashboard analytics and statistics',
        category: 'Basic'
      },
      {
        id: 'userManagement',
        name: 'User Management',
        description: 'Manage customer accounts and profiles',
        category: 'Operations'
      },
      {
        id: 'teamManagement',
        name: 'Team Management',
        description: 'Manage admin team members and their permissions',
        category: 'Administration'
      },
      {
        id: 'ordersShipping',
        name: 'Orders & Shipping',
        description: 'Manage orders, shipments, and deliveries',
        category: 'Operations'
      },
      {
        id: 'financialOperations',
        name: 'Financial Operations',
        description: 'Handle billing, invoices, and payment reconciliation',
        category: 'Finance'
      },
      {
        id: 'systemConfig',
        name: 'System Configuration',
        description: 'Configure system settings and preferences',
        category: 'Administration'
      },
      {
        id: 'sellerManagement',
        name: 'Seller Management',
        description: 'Manage seller accounts, onboarding, and support',
        category: 'Operations'
      },
      {
        id: 'supportTickets',
        name: 'Support Tickets',
        description: 'Handle customer and seller support tickets',
        category: 'Support'
      },
      {
        id: 'reportsAnalytics',
        name: 'Reports & Analytics',
        description: 'Generate and view detailed reports and analytics',
        category: 'Analytics'
      },
      {
        id: 'marketingPromotions',
        name: 'Marketing & Promotions',
        description: 'Manage marketing campaigns and promotions',
        category: 'Marketing'
      }
    ];

    // Get access statistics for each section
    const accessStatistics = await getSectionAccessStats();

    // Get number of admins with access to each section
    const adminCounts = await Admin.aggregate([
      { $match: { status: 'Active' } },
      {
        $group: {
          _id: null,
          dashboardAccess: {
            $sum: { $cond: [{ $eq: ["$permissions.dashboardAccess", true] }, 1, 0] }
          },
          userManagement: {
            $sum: { $cond: [{ $eq: ["$permissions.userManagement", true] }, 1, 0] }
          },
          teamManagement: {
            $sum: { $cond: [{ $eq: ["$permissions.teamManagement", true] }, 1, 0] }
          },
          ordersShipping: {
            $sum: { $cond: [{ $eq: ["$permissions.ordersShipping", true] }, 1, 0] }
          },
          financialOperations: {
            $sum: { $cond: [{ $eq: ["$permissions.financialOperations", true] }, 1, 0] }
          },
          systemConfig: {
            $sum: { $cond: [{ $eq: ["$permissions.systemConfig", true] }, 1, 0] }
          },
          sellerManagement: {
            $sum: { $cond: [{ $eq: ["$permissions.sellerManagement", true] }, 1, 0] }
          },
          supportTickets: {
            $sum: { $cond: [{ $eq: ["$permissions.supportTickets", true] }, 1, 0] }
          },
          reportsAnalytics: {
            $sum: { $cond: [{ $eq: ["$permissions.reportsAnalytics", true] }, 1, 0] }
          },
          marketingPromotions: {
            $sum: { $cond: [{ $eq: ["$permissions.marketingPromotions", true] }, 1, 0] }
          },
          totalAdmins: { $sum: 1 }
        }
      }
    ]);

    // Get total active admins
    const totalActiveAdmins = adminCounts.length > 0 ? adminCounts[0].totalAdmins : 0;

    // Combine data
    const sectionsWithStats = systemSections.map(section => {
      return {
        ...section,
        adminsWithAccess: adminCounts.length > 0 ? adminCounts[0][section.id] || 0 : 0,
        accessPercentage: totalActiveAdmins > 0
          ? ((adminCounts.length > 0 ? adminCounts[0][section.id] || 0 : 0) / totalActiveAdmins) * 100
          : 0,
        accessStats: accessStatistics[section.id] || {
          totalAccesses: 0,
          lastAccessed: null
        }
      };
    });

    // Group by category
    const sectionsByCategory = {};
    sectionsWithStats.forEach(section => {
      if (!sectionsByCategory[section.category]) {
        sectionsByCategory[section.category] = [];
      }
      sectionsByCategory[section.category].push(section);
    });

    res.status(200).json({
      success: true,
      data: {
        sections: sectionsWithStats,
        categories: sectionsByCategory,
        totalActiveAdmins
      }
    });
  } catch (error) {
    logger.error(`Error in getSystemSections: ${error.message}`);
    next(new AppError('Failed to fetch system sections', 500));
  }
};

/**
 * Helper function to get section access statistics from logs
 * @returns {Object} Access statistics by section
 */
const getSectionAccessStats = async () => {
  // In a production system, this would query your audit logs or analytics
  // This is a placeholder implementation

  // Mock data - in a real system, replace with actual database queries
  const mockStats = {
    'dashboardAccess': {
      totalAccesses: 842,
      lastAccessed: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
    },
    'userManagement': {
      totalAccesses: 356,
      lastAccessed: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
    },
    'teamManagement': {
      totalAccesses: 124,
      lastAccessed: new Date(Date.now() - 45 * 60 * 1000) // 45 minutes ago
    },
    'ordersShipping': {
      totalAccesses: 762,
      lastAccessed: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
    },
    'financialOperations': {
      totalAccesses: 315,
      lastAccessed: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    },
    'systemConfig': {
      totalAccesses: 89,
      lastAccessed: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
    },
    'sellerManagement': {
      totalAccesses: 427,
      lastAccessed: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
    },
    'supportTickets': {
      totalAccesses: 621,
      lastAccessed: new Date(Date.now() - 8 * 60 * 1000) // 8 minutes ago
    },
    'reportsAnalytics': {
      totalAccesses: 278,
      lastAccessed: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
    },
    'marketingPromotions': {
      totalAccesses: 185,
      lastAccessed: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
    }
  };

  return mockStats;
};

/**
 * Transform team member data for frontend consumption
 * Flattens nested financial details and documents
 */
const transformTeamMemberData = (teamMember) => {
  if (!teamMember) return null;

  const transformed = teamMember.toObject ? teamMember.toObject() : { ...teamMember };

  // Flatten financial details
  if (transformed.financialDetails) {
    const { financialDetails } = transformed;

    // Add flat financial fields
    transformed.aadharNumber = financialDetails.aadharNumber;
    transformed.panNumber = financialDetails.panNumber;

    // Flatten bank details
    if (financialDetails.bankDetails) {
      transformed.bankAccountNumber = financialDetails.bankDetails.accountNumber;
      transformed.ifscCode = financialDetails.bankDetails.ifscCode;
      transformed.bankName = financialDetails.bankDetails.bankName;
      transformed.accountHolderName = financialDetails.bankDetails.accountHolderName;
    }
  }

  // Transform profile image path to accessible URL with proper encoding
  if (transformed.profileImage) {
    // Debug logging for profile image transformation
    console.log(`Transforming profile image for ${transformed.fullName}: ${transformed.profileImage}`);

    // Convert local file path to accessible URL
    if (transformed.profileImage.startsWith('/') || transformed.profileImage.includes('uploads')) {
      // Local file path - convert to URL
      const fileName = transformed.profileImage.split('/').pop();
      // Properly encode the filename for URL safety
      const encodedFileName = encodeURIComponent(fileName);
      transformed.profileImage = `/uploads/admin-documents/${encodedFileName}`;
      console.log(`Profile image transformed to: ${transformed.profileImage}`);
    } else if (!transformed.profileImage.startsWith('http')) {
      // Relative path or filename only - make it a proper URL
      const encodedFileName = encodeURIComponent(transformed.profileImage);
      transformed.profileImage = `/uploads/admin-documents/${encodedFileName}`;
      console.log(`Profile image relative path transformed to: ${transformed.profileImage}`);
    }
  } else {
    console.log(`No profile image found for ${transformed.fullName || 'Unknown user'}`);
  }

  // Transform document paths to URLs and flatten document structure
  if (transformed.documents) {
    const { documents } = transformed;

    // Helper function to convert path to URL with proper encoding
    const convertPathToUrl = (filePath) => {
      if (!filePath) return null;
      if (filePath.startsWith('http')) return filePath; // Already a URL

      // Extract filename from path and encode it
      const fileName = filePath.split('/').pop();
      const encodedFileName = encodeURIComponent(fileName);
      return `/uploads/admin-documents/${encodedFileName}`;
    };

    // Handle new document types (stored as strings)
    if (documents.aadharDocument) {
      transformed.aadharDocument = convertPathToUrl(documents.aadharDocument);
    }
    if (documents.panDocument) {
      transformed.panDocument = convertPathToUrl(documents.panDocument);
    }
    if (documents.bankPassbookDocument) {
      transformed.bankPassbookDocument = convertPathToUrl(documents.bankPassbookDocument);
    }

    // Handle legacy document types (stored as objects)
    if (documents.idProof) {
      transformed.idProofDocument = documents.idProof.url || convertPathToUrl(documents.idProof.name);
    }
    if (documents.employmentContract) {
      transformed.employmentContractDocument = documents.employmentContract.url || convertPathToUrl(documents.employmentContract.name);
    }

    // Keep the original documents structure for backward compatibility
    // but convert paths to URLs with proper encoding
    const transformedDocuments = { ...documents };

    Object.keys(transformedDocuments).forEach(key => {
      if (typeof transformedDocuments[key] === 'string') {
        transformedDocuments[key] = convertPathToUrl(transformedDocuments[key]);
      } else if (transformedDocuments[key] && transformedDocuments[key].url) {
        transformedDocuments[key].url = convertPathToUrl(transformedDocuments[key].url);
      }
    });

    transformed.documents = transformedDocuments;
  }

  // Remove the nested structure to avoid confusion
  delete transformed.financialDetails;

  return transformed;
};

/**
 * Debug endpoint to check profile image data
 * @route GET /api/v2/admin/team/debug-profile/:userId
 * @access Private (Admin only)
 */
export const debugProfileImage = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const teamMember = await Admin.findById(userId).select('-password');

    if (!teamMember) {
      return next(new AppError('Team member not found', 404));
    }

    // Transform data to see what frontend would receive
    const transformedData = transformTeamMemberData(teamMember);

    res.status(200).json({
      success: true,
      data: {
        original: {
          fullName: teamMember.fullName,
          profileImage: teamMember.profileImage,
          documents: teamMember.documents
        },
        transformed: {
          fullName: transformedData.fullName,
          profileImage: transformedData.profileImage,
          aadharDocument: transformedData.aadharDocument,
          panDocument: transformedData.panDocument,
          bankPassbookDocument: transformedData.bankPassbookDocument
        }
      }
    });
  } catch (error) {
    logger.error(`Error in debugProfileImage: ${error.message}`);
    next(new AppError('Failed to debug profile image', 500));
  }
};

import jwt from 'jsonwebtoken';
import { AppError } from '../../../middleware/errorHandler.js';
import { sendEmail } from '../../../utils/email.js';
import { generateEmployeeId } from '../../../utils/employeeId.js';
import { logger } from '../../../utils/logger.js';
import { deleteSession, getSession, setSession } from '../../../utils/redis.js';
import Admin from '../models/admin.model.js';
import Session from '../models/session.model.js';

/**
 * Generate JWT token for admin
 * @param {object} admin - Admin user object
 */
const generateToken = (admin) => {
  return jwt.sign(
    {
      id: admin._id,
      role: admin.role,
      isSuperAdmin: admin.isSuperAdmin
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' } // 24 hours - hardcoded for admin tokens
  );
};

/**
 * Admin login
 * @route POST /api/v2/admin/auth/login
 * @access Public
 */
export const login = async (req, res, next) => {
  try {
    const { email, password, rememberMe = false } = req.body;

    console.log('Login attempt:', { email, hasPassword: !!password, rememberMe });

    // 1) Check if email and password exist
    if (!email || !password) {
      console.log('Missing email or password');
      return next(new AppError('Please provide email and password', 400));
    }

    // 2) Check if admin exists && password is correct
    const admin = await Admin.findOne({ email }).select('+password');
    console.log('Admin found:', {
      exists: !!admin,
      email: admin?.email,
      status: admin?.status,
      hasPassword: !!admin?.password
    });

    if (!admin) {
      console.log('Admin not found');
      return next(new AppError('Incorrect email or password', 401));
    }

    const passwordCorrect = await admin.isPasswordCorrect(password);
    console.log('Password check:', { passwordCorrect });

    if (!passwordCorrect) {
      console.log('Password incorrect');
      return next(new AppError('Incorrect email or password', 401));
    }

    // 3) Check if admin is active
    if (admin.status !== 'Active') {
      console.log('Admin not active:', admin.status);
      return next(new AppError('Your account is not active. Please contact a super admin.', 403));
    }

    // 4) Update last login info
    admin.lastLoginAt = new Date();
    admin.lastLoginIP = req.ip;
    await admin.save({ validateBeforeSave: false });

    // 5) Generate JWT token
    const token = generateToken(admin);

    // 6) Get device info from user agent
    const userAgent = req.headers['user-agent'];
    const deviceInfo = {
      deviceType: 'Unknown',
      os: 'Unknown',
      browser: userAgent || 'Unknown',
    };

    // 7) Create session expiry time (default: 1 hour, remember me: 7 days)
    const expiresIn = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000; // 7 days or 1 hour
    const expiresAt = new Date(Date.now() + expiresIn);

    // 8) Create session in database
    const session = await Session.create({
      adminId: admin._id,
      token,
      deviceInfo,
      ipAddress: req.ip,
      isActive: true,
      expiresAt
    });

    // Helper function to convert permissions object to array
    const getPermissionsArray = (permissionsObj) => {
      if (!permissionsObj || typeof permissionsObj !== 'object') {
        return [];
      }

      const permissions = [];
      Object.keys(permissionsObj).forEach(key => {
        if (permissionsObj[key] === true) {
          permissions.push(key);
        }
      });

      return permissions;
    };

    // 9) Store session in Redis for fast access
    try {
      // Convert permissions object to array for Redis storage only
      const permissionsArray = getPermissionsArray(admin.permissions);

      const sessionStored = await setSession(admin._id.toString(), JSON.stringify({
        sessionId: session._id.toString(),
        user: {
          id: admin._id,
          name: admin.fullName,
          email: admin.email,
          role: admin.role,
          isSuperAdmin: admin.isSuperAdmin,
          permissions: permissionsArray // Array for Redis
        },
        lastActivity: Date.now()
      }), expiresIn / 1000); // Redis expiry in seconds

      if (!sessionStored) {
        logger.warn('Redis session storage failed, but login will continue with database session only');
      }
    } catch (redisError) {
      logger.error('Redis session error during login:', redisError.message);
      logger.warn('Login will continue with database session only');
    }

    // 10) Remove password from output
    admin.password = undefined;

    logger.info(`Admin ${admin._id} logged in successfully`);

    // 11) Send response with permissions as object for frontend
    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: admin._id,
          name: admin.fullName,
          email: admin.email,
          role: admin.role,
          department: admin.department,
          isSuperAdmin: admin.isSuperAdmin,
          permissions: admin.permissions || {} // Send as object, not array
        }
      }
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    next(new AppError('Failed to login', 500));
  }
};

/**
 * Register a new admin
 * @route POST /api/v2/admin/auth/register
 * @access Private (Super Admin only)
 */
export const register = async (req, res, next) => {
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
      isSuperAdmin,
      remarks,
      password,
      confirmPassword,
      // Profile image will be handled separately with file upload
    } = req.body;

    // 1) Check if passwords match
    if (password !== confirmPassword) {
      return next(new AppError('Passwords do not match', 400));
    }

    // 2) Check if email already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return next(new AppError('Email already in use', 400));
    }

    // 3) Generate employee ID if not provided
    let finalEmployeeId = employeeId;
    if (!finalEmployeeId) {
      finalEmployeeId = await generateEmployeeId(department);
    } else {
      // Check if provided employee ID already exists
      const existingEmployeeId = await Admin.findOne({ employeeId: finalEmployeeId });
      if (existingEmployeeId) {
        return next(new AppError('Employee ID already in use', 400));
      }
    }

    // 4) Create new admin
    const newAdmin = await Admin.create({
      fullName,
      email,
      role,
      department,
      phoneNumber,
      address,
      dateOfJoining: dateOfJoining || Date.now(),
      employeeId: finalEmployeeId,
      isSuperAdmin: isSuperAdmin || false,
      status: 'Active',
      remarks,
      password,
      // If profile image was uploaded, it would be added here
      profileImage: req.file?.path || null,
    });

    // 5) Remove password from response
    newAdmin.password = undefined;

    logger.info(`New admin ${newAdmin._id} created by admin ${req.user?.id} with employee ID ${finalEmployeeId}`);

    // 6) Send welcome email with login credentials
    try {
      await sendEmail({
        to: email,
        subject: 'Welcome to Rocketry Box Admin - Your Account Details',
        template: 'admin-welcome',
        data: {
          name: fullName,
          role,
          department,
          employeeId: finalEmployeeId,
          email: email,
          tempPassword: password, // The original password entered
          loginUrl: `${process.env.ADMIN_FRONTEND_URL}/admin/login`,
          adminPortalUrl: process.env.ADMIN_FRONTEND_URL || 'https://admin.rocketrybox.com'
        }
      });
    } catch (emailError) {
      logger.error(`Failed to send welcome email to ${email}: ${emailError.message}`);
      // Continue with registration even if email fails
    }

    // 7) Send response
    res.status(201).json({
      success: true,
      data: {
        id: newAdmin._id,
        name: newAdmin.fullName,
        email: newAdmin.email,
        role: newAdmin.role,
        department: newAdmin.department,
        employeeId: finalEmployeeId,
        isSuperAdmin: newAdmin.isSuperAdmin,
        createdAt: newAdmin.createdAt
      }
    });
  } catch (error) {
    logger.error(`Register error: ${error.message}`);
    next(new AppError('Failed to register admin', 500));
  }
};

/**
 * Refresh admin token
 * @route POST /api/v2/admin/auth/refresh-token
 * @access Private
 */
export const refreshToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new AppError('Not logged in', 401));
    }

    // 1) Verify the current token (even if expired)
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        // Allow refresh for expired tokens
        decoded = jwt.decode(token);
      } else {
        return next(new AppError('Invalid token', 401));
      }
    }

    // 2) Check if admin still exists
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return next(new AppError('Admin no longer exists', 401));
    }

    // 3) Check if admin is still active
    if (admin.status !== 'Active') {
      return next(new AppError('Admin account is not active', 403));
    }

    // 4) Generate new token
    const newToken = generateToken(admin);

    // 5) Update session in database
    const session = await Session.findOne({ token, adminId: admin._id });
    if (session && session.isActive) {
      session.token = newToken;
      session.lastActive = new Date();
      await session.save();
    }

    // 6) Update Redis session
    try {
      const permissionsArray = Object.keys(admin.permissions || {}).filter(key => admin.permissions[key] === true);
      await setSession(admin._id.toString(), JSON.stringify({
        sessionId: session?._id?.toString(),
        user: {
          id: admin._id,
          name: admin.fullName,
          email: admin.email,
          role: admin.role,
          isSuperAdmin: admin.isSuperAdmin,
          permissions: permissionsArray
        },
        lastActivity: Date.now()
      }), 24 * 60 * 60); // 24 hours in seconds
    } catch (redisError) {
      logger.warn('Redis session update failed during token refresh:', redisError.message);
    }

    logger.info(`Admin ${admin._id} token refreshed successfully`);

    res.status(200).json({
      success: true,
      data: {
        accessToken: newToken,
        expiresIn: 24 * 60 * 60 // 24 hours in seconds
      }
    });
  } catch (error) {
    logger.error(`Token refresh error: ${error.message}`);
    next(new AppError('Failed to refresh token', 500));
  }
};

/**
 * Get current admin's profile
 * @route GET /api/v2/admin/auth/profile
 * @access Private
 */
export const getProfile = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.user.id);

    if (!admin) {
      return next(new AppError('Admin not found', 404));
    }

    res.status(200).json({
      success: true,
      data: admin
    });
  } catch (error) {
    logger.error(`Get profile error: ${error.message}`);
    next(new AppError('Failed to get profile', 500));
  }
};

/**
 * Logout admin
 * @route POST /api/v2/admin/auth/logout
 * @access Private
 */
export const logout = async (req, res, next) => {
  try {
    // 1) Get token from header
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new AppError('Not logged in', 401));
    }

    // 2) Find and update session in database
    const session = await Session.findOne({ token, isActive: true });

    if (session) {
      session.isActive = false;
      await session.save();
    }

    // 3) Remove session from Redis
    try {
      const sessionDeleted = await deleteSession(req.user.id);
      if (!sessionDeleted) {
        logger.warn('Redis session deletion failed, but logout will continue');
      }
    } catch (redisError) {
      logger.error('Redis session deletion error during logout:', redisError.message);
      logger.warn('Logout will continue without Redis session cleanup');
    }

    logger.info(`Admin ${req.user.id} logged out successfully`);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    next(new AppError('Failed to logout', 500));
  }
};

/**
 * Get all active sessions for current admin
 * @route GET /api/v2/admin/auth/sessions
 * @access Private
 */
export const getSessions = async (req, res, next) => {
  try {
    const sessions = await Session.find({
      adminId: req.user.id,
      isActive: true,
      expiresAt: { $gt: new Date() }
    });

    res.status(200).json({
      success: true,
      data: sessions.map(session => ({
        id: session._id,
        deviceInfo: session.deviceInfo,
        lastActive: session.lastActive,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt
      }))
    });
  } catch (error) {
    logger.error(`Get sessions error: ${error.message}`);
    next(new AppError('Failed to get sessions', 500));
  }
};

/**
 * Revoke a specific session
 * @route DELETE /api/v2/admin/auth/sessions/:sessionId
 * @access Private
 */
export const revokeSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({
      _id: sessionId,
      adminId: req.user.id
    });

    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    // Update session in database
    session.isActive = false;
    await session.save();

    // If the revoked session is the current one, also remove from Redis
    const token = req.headers.authorization?.split(' ')[1];
    if (session.token === token) {
      await deleteSession(req.user.id);
    }

    logger.info(`Admin ${req.user.id} revoked session ${sessionId}`);

    res.status(200).json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    logger.error(`Revoke session error: ${error.message}`);
    next(new AppError('Failed to revoke session', 500));
  }
};

/**
 * Revoke all sessions for current admin except the current one
 * @route DELETE /api/v2/admin/auth/sessions
 * @access Private
 */
export const revokeAllSessions = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    // Update all sessions except current one in database
    await Session.updateMany(
      {
        adminId: req.user.id,
        isActive: true,
        token: { $ne: token }
      },
      { isActive: false }
    );

    logger.info(`Admin ${req.user.id} revoked all other sessions`);

    res.status(200).json({
      success: true,
      message: 'All other sessions revoked successfully'
    });
  } catch (error) {
    logger.error(`Revoke all sessions error: ${error.message}`);
    next(new AppError('Failed to revoke sessions', 500));
  }
};

/**
 * Impersonate a seller - Super Admin only
 * @route POST /api/v2/admin/auth/impersonate/seller/:sellerId
 * @access Private (Super Admin only)
 */
export const impersonateSeller = async (req, res, next) => {
  try {
    const { sellerId } = req.params;

    // Only Super Admins can impersonate
    if (!req.user.isSuperAdmin) {
      return next(new AppError('Only Super Admins can impersonate users', 403));
    }

    // Find the seller
    const Seller = (await import('../../seller/models/seller.model.js')).default;

    let seller;

    // Check if sellerId is a valid MongoDB ObjectId (24 character hex string)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(sellerId);

    if (isValidObjectId) {
      seller = await Seller.findById(sellerId);
    } else {
      // Try to find by email or business name if not a valid ObjectId
      seller = await Seller.findOne({
        $or: [
          { email: sellerId },
          { businessName: sellerId }
        ]
      });
    }

    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    if (seller.status !== 'active') {
      return next(new AppError('Cannot impersonate inactive seller', 400));
    }

    // Generate seller token with impersonation info
    const token = jwt.sign(
      {
        id: seller._id,
        email: seller.email,
        role: 'seller',
        impersonatedBy: req.user.id,
        isImpersonated: true
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' } // 24 hours - hardcoded
    );

    // Store impersonation session info
    try {
      await setSession(`impersonation:${req.user.id}:${seller._id}`, JSON.stringify({
        adminId: req.user.id,
        adminEmail: req.user.email,
        adminName: req.user.fullName,
        targetId: seller._id,
        targetEmail: seller.email,
        targetType: 'seller',
        startedAt: new Date(),
        sessionId: token.slice(-20) // Last 20 chars as session identifier
      }), 24 * 60 * 60); // 24 hours
    } catch (redisError) {
      logger.warn('Failed to store impersonation session in Redis:', redisError.message);
    }

    // Log the impersonation for audit
    logger.info(`Super Admin ${req.user.id} (${req.user.email}) started impersonating seller ${seller._id} (${seller.email})`);

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: seller._id,
          name: seller.name,
          email: seller.email,
          type: 'seller',
          impersonatedBy: {
            id: req.user.id,
            name: req.user.fullName,
            email: req.user.email
          }
        },
        redirectTo: '/seller/dashboard'
      }
    });
  } catch (error) {
    logger.error(`Seller impersonation error: ${error.message}`);
    next(new AppError('Failed to impersonate seller', 500));
  }
};

/**
 * Impersonate a customer - Super Admin only
 * @route POST /api/v2/admin/auth/impersonate/customer/:customerId
 * @access Private (Super Admin only)
 */
export const impersonateCustomer = async (req, res, next) => {
  try {
    const { customerId } = req.params;

    // Only Super Admins can impersonate
    if (!req.user.isSuperAdmin) {
      return next(new AppError('Only Super Admins can impersonate users', 403));
    }

    // Find the customer
    const Customer = (await import('../../customer/models/customer.model.js')).default;

    let customer;

    // Check if customerId is a valid MongoDB ObjectId (24 character hex string)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(customerId);

    if (isValidObjectId) {
      customer = await Customer.findById(customerId);
    } else {
      customer = await Customer.findOne({ rbUserId: customerId });
    }

    if (!customer) {
      return next(new AppError('Customer not found', 404));
    }

    if (customer.status !== 'active') {
      return next(new AppError('Cannot impersonate inactive customer', 400));
    }

    // Generate customer token with impersonation info
    const token = jwt.sign(
      {
        id: customer._id,
        email: customer.email,
        role: 'customer',
        impersonatedBy: req.user.id,
        isImpersonated: true
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' } // 24 hours - hardcoded
    );

    // Store impersonation session info
    try {
      await setSession(`impersonation:${req.user.id}:${customer._id}`, JSON.stringify({
        adminId: req.user.id,
        adminEmail: req.user.email,
        adminName: req.user.fullName,
        targetId: customer._id,
        targetEmail: customer.email,
        targetType: 'customer',
        startedAt: new Date(),
        sessionId: token.slice(-20) // Last 20 chars as session identifier
      }), 24 * 60 * 60); // 24 hours
    } catch (redisError) {
      logger.warn('Failed to store impersonation session in Redis:', redisError.message);
    }

    // Log the impersonation for audit
    logger.info(`Super Admin ${req.user.id} (${req.user.email}) started impersonating customer ${customer._id} (${customer.email})`);

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: customer._id,
          name: customer.name || customer.fullName,
          email: customer.email,
          type: 'customer',
          impersonatedBy: {
            id: req.user.id,
            name: req.user.fullName,
            email: req.user.email
          }
        },
        redirectTo: '/customer/home'
      }
    });
  } catch (error) {
    logger.error(`Customer impersonation error: ${error.message}`);
    next(new AppError('Failed to impersonate customer', 500));
  }
};

/**
 * Stop impersonation and return to admin session
 * @route POST /api/v2/admin/auth/stop-impersonation
 * @access Private (Impersonated sessions only)
 */
export const stopImpersonation = async (req, res, next) => {
  try {
    // Check if this is an impersonated session
    if (!req.user.isImpersonated || !req.user.impersonatedBy) {
      return next(new AppError('Not in an impersonated session', 400));
    }

    const adminId = req.user.impersonatedBy;
    const targetId = req.user.id;

    // Find the original admin
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return next(new AppError('Original admin not found', 404));
    }

    // Clean up impersonation session
    try {
      await deleteSession(`impersonation:${adminId}:${targetId}`);
    } catch (redisError) {
      logger.warn('Failed to clean up impersonation session from Redis:', redisError.message);
    }

    // Generate new admin token
    const adminToken = generateToken(admin);

    // Log the end of impersonation
    logger.info(`Super Admin ${adminId} (${admin.email}) stopped impersonating user ${targetId}`);

    res.status(200).json({
      success: true,
      data: {
        token: adminToken,
        user: {
          id: admin._id,
          name: admin.fullName,
          email: admin.email,
          role: admin.role,
          isSuperAdmin: admin.isSuperAdmin,
          permissions: admin.permissions
        },
        redirectTo: '/admin/dashboard'
      },
      message: 'Impersonation ended successfully'
    });
  } catch (error) {
    logger.error(`Stop impersonation error: ${error.message}`);
    next(new AppError('Failed to stop impersonation', 500));
  }
};

/**
 * Get current impersonation status
 * @route GET /api/v2/admin/auth/impersonation-status
 * @access Private
 */
export const getImpersonationStatus = async (req, res, next) => {
  try {
    if (!req.user.isImpersonated) {
      return res.status(200).json({
        success: true,
        data: {
          isImpersonated: false
        }
      });
    }

    // Get impersonation details from Redis
    let impersonationDetails = null;
    try {
      const sessionData = await getSession(`impersonation:${req.user.impersonatedBy}:${req.user.id}`);
      if (sessionData) {
        impersonationDetails = JSON.parse(sessionData);
      }
    } catch (redisError) {
      logger.warn('Failed to get impersonation details from Redis:', redisError.message);
    }

    res.status(200).json({
      success: true,
      data: {
        isImpersonated: true,
        impersonatedBy: req.user.impersonatedBy,
        targetUser: {
          id: req.user.id,
          email: req.user.email,
          type: req.user.role
        },
        details: impersonationDetails
      }
    });
  } catch (error) {
    logger.error(`Get impersonation status error: ${error.message}`);
    next(new AppError('Failed to get impersonation status', 500));
  }
};

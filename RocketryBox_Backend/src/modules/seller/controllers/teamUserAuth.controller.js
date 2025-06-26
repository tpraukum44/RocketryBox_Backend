import jwt from 'jsonwebtoken';
import { AppError } from '../../../middleware/errorHandler.js';
import { emitEvent, EVENT_TYPES } from '../../../utils/eventEmitter.js';
import TeamUser from '../models/teamUser.model.js';

// Team User Login
export const teamUserLogin = async (req, res, next) => {
  try {
    const { emailOrPhone, password, rememberMe } = req.body;

    if (!emailOrPhone || !password) {
      return next(new AppError('Email/phone and password are required', 400));
    }

    // Find team user by email or phone
    const teamUser = await TeamUser.findOne({
      $or: [
        { email: emailOrPhone.toLowerCase() },
        { phone: emailOrPhone }
      ]
    })
      .select('+password')
      .populate('seller', 'businessName email status');

    if (!teamUser) {
      return next(new AppError('Team user not found', 404));
    }

    // Check if team user account is active
    if (teamUser.status !== 'Active') {
      return next(new AppError(`Account is ${teamUser.status.toLowerCase()}. Please contact your admin.`, 403));
    }

    // Check if parent seller account is active
    if (!teamUser.seller || teamUser.seller.status === 'suspended') {
      return next(new AppError('Parent seller account is suspended. Please contact support.', 403));
    }

    // Verify password
    const isMatch = await teamUser.comparePassword(password);
    if (!isMatch) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Update login tracking
    teamUser.lastLogin = new Date();
    teamUser.lastActive = new Date();

    // Generate tokens
    const accessToken = teamUser.generateAuthToken();
    const refreshToken = teamUser.generateRefreshToken();
    teamUser.refreshToken = refreshToken;

    await teamUser.save();

    // Create Redis session for team user
    try {
      const { setSession } = await import('../../../utils/redis.js');
      const sessionData = {
        user: {
          id: teamUser._id,
          email: teamUser.email,
          role: 'team_user',
          name: teamUser.name,
          sellerId: teamUser.seller._id,
          businessName: teamUser.seller.businessName,
          status: teamUser.status,
          permissions: teamUser.permissions
        },
        lastActivity: Date.now(),
        createdAt: Date.now()
      };
      await setSession(teamUser._id.toString(), sessionData);
      console.log('✅ Team user session created in Redis');
    } catch (redisError) {
      console.warn('⚠️ Failed to create team user session in Redis:', redisError.message);
      // Don't fail login if Redis is unavailable
    }

    // Emit team user login event
    emitEvent(EVENT_TYPES.TEAM_USER_LOGIN || 'team_user_login', {
      teamUserId: teamUser._id,
      sellerId: teamUser.seller._id,
      businessName: teamUser.seller.businessName,
      email: teamUser.email,
      name: teamUser.name,
      role: teamUser.role
    });

    // Prepare response data
    const teamUserData = teamUser.toJSON();
    delete teamUserData.seller.status; // Remove sensitive seller data

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: rememberMe ? 604800 : 86400, // 7d or 1d
        teamUser: {
          id: teamUserData._id,
          name: teamUserData.name,
          email: teamUserData.email,
          phone: teamUserData.phone,
          role: teamUserData.role,
          permissions: teamUserData.permissions,
          seller: teamUserData.seller
        },
        userType: 'team_user'
      }
    });
  } catch (error) {
    console.error('Team user login error:', error);
    next(new AppError(error.message, 400));
  }
};

// Team User Logout
export const teamUserLogout = async (req, res, next) => {
  try {
    const teamUser = await TeamUser.findById(req.user.id);
    if (teamUser) {
      teamUser.refreshToken = null;
      await teamUser.save();
    }

    // Clear Redis session
    try {
      const { deleteSession } = await import('../../../utils/redis.js');
      await deleteSession(req.user.id);
      console.log('✅ Team user session cleared from Redis');
    } catch (redisError) {
      console.warn('⚠️ Failed to clear team user session from Redis:', redisError.message);
    }

    // Emit team user logout event
    emitEvent(EVENT_TYPES.TEAM_USER_LOGOUT || 'team_user_logout', {
      teamUserId: req.user.id,
      sellerId: req.user.sellerId
    });

    res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully' }
    });
  } catch (error) {
    console.error('Team user logout error:', error);
    next(new AppError(error.message, 400));
  }
};

// Team User Refresh Token
export const teamUserRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AppError('Refresh token required', 400));
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      return next(new AppError('Invalid refresh token', 401));
    }

    // Verify payload role
    if (payload.role !== 'team_user') {
      return next(new AppError('Invalid refresh token', 401));
    }

    const teamUser = await TeamUser.findById(payload.id)
      .populate('seller', 'businessName email status');

    if (!teamUser || teamUser.refreshToken !== refreshToken) {
      return next(new AppError('Invalid refresh token', 401));
    }

    // Check if team user is still active
    if (teamUser.status !== 'Active') {
      return next(new AppError('Account is no longer active', 401));
    }

    // Check if parent seller account is still active
    if (!teamUser.seller || teamUser.seller.status === 'suspended') {
      return next(new AppError('Parent seller account is suspended', 401));
    }

    // Generate new tokens
    const newAccessToken = teamUser.generateAuthToken();
    const newRefreshToken = teamUser.generateRefreshToken();

    teamUser.refreshToken = newRefreshToken;
    teamUser.lastActive = new Date();
    await teamUser.save();

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 86400 // 24 hours
      }
    });
  } catch (error) {
    console.error('Team user refresh token error:', error);
    next(new AppError(error.message, 400));
  }
};

// Get Team User Profile
export const getTeamUserProfile = async (req, res, next) => {
  try {
    const teamUser = await TeamUser.findById(req.user.id)
      .populate('seller', 'businessName email phone address');

    if (!teamUser) {
      return next(new AppError('Team user not found', 404));
    }

    res.status(200).json({
      success: true,
      data: teamUser
    });
  } catch (error) {
    console.error('Get team user profile error:', error);
    next(new AppError(error.message, 400));
  }
};

// Update Team User Profile (limited fields)
export const updateTeamUserProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;

    const teamUser = await TeamUser.findById(req.user.id);
    if (!teamUser) {
      return next(new AppError('Team user not found', 404));
    }

    // Only allow certain fields to be updated by team user
    if (name) teamUser.name = name;
    if (phone) teamUser.phone = phone;

    await teamUser.save();

    res.status(200).json({
      success: true,
      data: teamUser
    });
  } catch (error) {
    console.error('Update team user profile error:', error);
    next(new AppError(error.message, 400));
  }
};

// Change Team User Password
export const changeTeamUserPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return next(new AppError('All password fields are required', 400));
    }

    if (newPassword !== confirmPassword) {
      return next(new AppError('New passwords do not match', 400));
    }

    if (newPassword.length < 6) {
      return next(new AppError('Password must be at least 6 characters long', 400));
    }

    const teamUser = await TeamUser.findById(req.user.id).select('+password');
    if (!teamUser) {
      return next(new AppError('Team user not found', 404));
    }

    // Verify current password
    const isMatch = await teamUser.comparePassword(currentPassword);
    if (!isMatch) {
      return next(new AppError('Current password is incorrect', 401));
    }

    // Update password
    teamUser.password = newPassword;
    await teamUser.save();

    res.status(200).json({
      success: true,
      data: { message: 'Password changed successfully' }
    });
  } catch (error) {
    console.error('Change team user password error:', error);
    next(new AppError(error.message, 400));
  }
};

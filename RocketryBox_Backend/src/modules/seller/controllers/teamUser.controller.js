import crypto from 'crypto';
import { AppError } from '../../../middleware/errorHandler.js';
import { sendEmail } from '../../../utils/email.js';
import AuditLog from '../models/auditLog.model.js';
import TeamUser from '../models/teamUser.model.js';

// Helper to generate secure random password
function generateSecurePassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(charset.length);
    password += charset[randomIndex];
  }
  return password;
}

// List team users
export const listTeamUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status, role } = req.query;
    const query = { seller: req.user.id };
    if (status) query.status = status;
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      TeamUser.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      TeamUser.countDocuments(query)
    ]);
    res.status(200).json({
      success: true,
      data: {
        users,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Add/invite team user
export const addTeamUser = async (req, res, next) => {
  try {
    const { name, email, phone, role, password } = req.body;

    // Validate role
    const validRoles = ['Manager', 'Support', 'Finance'];
    if (!role || !validRoles.includes(role)) {
      throw new AppError('Invalid role. Must be one of: Manager, Support, Finance', 400);
    }

    // Check if team user with this email already exists
    const exists = await TeamUser.findOne({ email: email.toLowerCase() });
    if (exists) {
      throw new AppError('User with this email already exists', 409);
    }

    // Generate secure password if not provided
    const teamUserPassword = password || generateSecurePassword();

    // Create team user - permissions will be auto-assigned based on role
    const user = await TeamUser.create({
      seller: req.user.id,
      name,
      email: email.toLowerCase(),
      phone,
      password: teamUserPassword,
      role,
      status: 'Active', // Set to Active so they can login immediately
      invitedBy: req.user.id
    });

    // Create audit log
    await AuditLog.createLog({
      seller: req.user.id,
      entityType: 'TeamUser',
      entityId: user._id,
      action: 'CREATE',
      performedBy: req.user.id,
      performedByModel: 'Seller',
      performedByName: req.user.businessName || req.user.name,
      description: `Created team user: ${name} (${email}) with role: ${role}`,
      newData: {
        name,
        email: email.toLowerCase(),
        phone,
        role,
        status: 'Active'
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'MEDIUM'
    });

    // Send credentials email
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('\n========== TEAM USER CREDENTIALS ==========');
        console.log(`📧 Email: ${email}`);
        console.log(`🔐 Password: ${teamUserPassword}`);
        console.log(`👤 Role: ${role || 'Staff'}`);
        console.log(`🏢 Business: ${req.user.businessName}`);
        console.log('==========================================\n');
      }

      await sendEmail({
        to: email,
        subject: 'Your RocketryBox Team Access Credentials',
        text: `
Hello ${name},

You have been added as a team member to ${req.user.businessName} on RocketryBox.

Your login credentials:
Email: ${email}
Password: ${teamUserPassword}
Role: ${role || 'Staff'}

Please log in at: ${process.env.FRONTEND_URL}/seller/auth/login

For security, please change your password after your first login.

Best regards,
RocketryBox Team
        `
      });
    } catch (emailError) {
      console.error('Failed to send team user credentials email:', emailError);
      // Don't fail the creation if email fails
    }

    // Return user data without password
    const userResponse = user.toJSON();

    res.status(201).json({
      success: true,
      data: {
        ...userResponse,
        // In development, include the password for testing
        ...(process.env.NODE_ENV === 'development' && { tempPassword: teamUserPassword })
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get team user details
export const getTeamUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await TeamUser.findOne({ _id: id, seller: req.user.id });
    if (!user) throw new AppError('Team user not found', 404);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// Update team user
export const updateTeamUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, role, status } = req.body;

    const user = await TeamUser.findOne({ _id: id, seller: req.user.id });
    if (!user) throw new AppError('Team user not found', 404);

    // Store old data for audit log
    const oldData = {
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status
    };

    // Validate role if provided
    if (role) {
      const validRoles = ['Manager', 'Support', 'Finance'];
      if (!validRoles.includes(role)) {
        throw new AppError('Invalid role. Must be one of: Manager, Support, Finance', 400);
      }
    }

    // Update fields
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (role && role !== user.role) {
      user.role = role;
      console.log(`🔐 Role changed for ${user.email}: ${oldData.role} → ${role}`);
    }
    if (status) user.status = status;

    await user.save();

    // Create audit log for changes
    const changedFields = [];
    if (name && name !== oldData.name) changedFields.push('name');
    if (phone && phone !== oldData.phone) changedFields.push('phone');
    if (role && role !== oldData.role) changedFields.push('role');
    if (status && status !== oldData.status) changedFields.push('status');

    if (changedFields.length > 0) {
      await AuditLog.createLog({
        seller: req.user.id,
        entityType: 'TeamUser',
        entityId: user._id,
        action: role && role !== oldData.role ? 'ROLE_CHANGE' : 'UPDATE',
        performedBy: req.user.id,
        performedByModel: 'Seller',
        performedByName: req.user.businessName || req.user.name,
        description: `Updated team user ${user.name}: ${changedFields.join(', ')}`,
        oldData,
        newData: {
          name: user.name,
          phone: user.phone,
          role: user.role,
          status: user.status
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        severity: role && role !== oldData.role ? 'HIGH' : 'MEDIUM'
      });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// Delete team user
export const deleteTeamUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await TeamUser.findOne({ _id: id, seller: req.user.id });
    if (!user) throw new AppError('Team user not found', 404);

    // Store data for audit log before deletion
    const userData = {
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status
    };

    await TeamUser.findOneAndDelete({ _id: id, seller: req.user.id });

    // Create audit log
    await AuditLog.createLog({
      seller: req.user.id,
      entityType: 'TeamUser',
      entityId: id,
      action: 'DELETE',
      performedBy: req.user.id,
      performedByModel: 'Seller',
      performedByName: req.user.businessName || req.user.name,
      description: `Deleted team user: ${userData.name} (${userData.email})`,
      oldData: userData,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'HIGH'
    });

    res.status(200).json({ success: true, data: { message: 'Team user deleted' } });
  } catch (error) {
    next(error);
  }
};

// Get available roles and their permissions
export const getRolesAndPermissions = async (req, res, next) => {
  try {
    const roles = ['Manager', 'Support', 'Finance'];
    const rolePermissions = {};

    roles.forEach(role => {
      rolePermissions[role] = TeamUser.getRolePermissions(role);
    });

    res.status(200).json({
      success: true,
      data: {
        roles,
        permissions: rolePermissions,
        restrictedPermissions: ['Wallet', 'Manage Users']
      }
    });
  } catch (error) {
    next(error);
  }
};

// Reset team user password
export const resetTeamUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const user = await TeamUser.findOne({ _id: id, seller: req.user.id });
    if (!user) {
      throw new AppError('Team user not found', 404);
    }

    // Generate new password if not provided
    const resetPassword = newPassword || generateSecurePassword();

    // Update password
    user.password = resetPassword;
    await user.save();

    // Send new credentials email
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('\n========== PASSWORD RESET ==========');
        console.log(`📧 Email: ${user.email}`);
        console.log(`🔐 New Password: ${resetPassword}`);
        console.log(`👤 User: ${user.name}`);
        console.log('===================================\n');
      }

      await sendEmail({
        to: user.email,
        subject: 'Your RocketryBox Password Has Been Reset',
        text: `
Hello ${user.name},

Your password has been reset by your team administrator.

Your new login credentials:
Email: ${user.email}
Password: ${resetPassword}

Please log in at: ${process.env.FRONTEND_URL}/seller/auth/login

For security, please change your password after logging in.

Best regards,
RocketryBox Team
        `
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Don't fail the reset if email fails
    }

    // Create audit log
    await AuditLog.createLog({
      seller: req.user.id,
      entityType: 'TeamUser',
      entityId: user._id,
      action: 'UPDATE',
      performedBy: req.user.id,
      performedByModel: 'Seller',
      performedByName: req.user.businessName || req.user.name,
      description: `Reset password for team user: ${user.name} (${user.email})`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'HIGH'
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Password reset successfully',
        // In development, include the password for testing
        ...(process.env.NODE_ENV === 'development' && { newPassword: resetPassword })
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get audit logs for team users
export const getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, action, entityType, startDate, endDate } = req.query;

    const result = await AuditLog.getSellerLogs(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
      action,
      entityType,
      startDate,
      endDate
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

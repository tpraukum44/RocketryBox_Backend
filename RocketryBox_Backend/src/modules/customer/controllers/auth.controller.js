import { AppError } from '../../../middleware/errorHandler.js';
import { sendEmail } from '../../../utils/email.js';
import { emitEvent, EVENT_TYPES } from '../../../utils/eventEmitter.js';
import { deleteSession, setOTP, setSession, verifyOTP } from '../../../utils/redis.js';
import { sendOTP as sendSMSOTP } from '../../../utils/sms.js';
import Customer from '../models/customer.model.js';

// Register new customer
export const register = async (req, res, next) => {
  try {
    const { name, email, mobile, password, confirmPassword, acceptTerms, mobileOtp, emailOtp } = req.body;

    // Validate terms acceptance
    if (!acceptTerms) {
      return next(new AppError('You must accept the terms and conditions', 400));
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return next(new AppError('Passwords do not match', 400));
    }

    // Validate mobile number
    if (!mobile || mobile.trim() === '') {
      return next(new AppError('Mobile number is required', 400));
    }

    // Validate OTPs
    if (!mobileOtp || mobileOtp.trim() === '') {
      return next(new AppError('Mobile OTP is required', 400));
    }

    if (!emailOtp || emailOtp.trim() === '') {
      return next(new AppError('Email OTP is required', 400));
    }

    // Verify mobile OTP from Redis (sent via sendOTP endpoint)
    const mobileOtpKey = `temp_${mobile}`;
    const mobileOtpResult = await verifyOTP(mobileOtpKey, mobileOtp);
    if (!mobileOtpResult.valid) {
      return next(new AppError('Invalid or expired mobile OTP', 400));
    }

    // Verify email OTP from Redis (sent via sendOTP endpoint)
    const emailOtpKey = `temp_${email}`;
    const emailOtpResult = await verifyOTP(emailOtpKey, emailOtp);
    if (!emailOtpResult.valid) {
      return next(new AppError('Invalid or expired email OTP', 400));
    }

    // For backwards compatibility, map mobile to phone field
    const phone = mobile;

    // Check if customer already exists
    const existingCustomer = await Customer.findOne({
      $or: [
        { email: email },
        { mobile: mobile },
        { phone: phone }
      ]
    });

    if (existingCustomer) {
      if (existingCustomer.email === email) {
        return next(new AppError('Email is already registered', 400));
      }
      if (existingCustomer.mobile === mobile || existingCustomer.phone === phone) {
        return next(new AppError('Mobile number is already registered', 400));
      }
      return next(new AppError('Email or phone number already registered', 400));
    }

    // Create new customer
    const customer = await Customer.create({
      name,
      email,
      mobile,
      phone,  // Set phone field to same value as mobile for consistency
      password
    });

    // Log the created customer for debugging
    console.log("Customer created successfully:", {
      id: customer._id,
      name: customer.name,
      email: customer.email,
      mobile: customer.mobile,
      phone: customer.phone
    });

    // Note: Email OTP verification is handled separately via the sendOTP endpoint
    // The frontend sends email OTP before calling register, so no need to send email here

    // Note: OTP verification is handled separately via the sendOTP endpoint
    // The frontend sends OTP before calling register, so no need to send SMS here

    // Generate tokens (registration doesn't use rememberMe)
    const accessToken = customer.generateAuthToken(false);
    const refreshToken = customer.generateRefreshToken(false);

    // Emit customer registered event for real-time dashboard updates
    emitEvent(EVENT_TYPES.CUSTOMER_REGISTERED, {
      customerId: customer._id,
      name: customer.name,
      email: customer.email
    });

    res.status(201).json({
      success: true,
      data: {
        message: 'Registration successful! Your account has been created and verified.',
        user: customer,
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    next(new AppError(error.message, 400));
  }
};

// Login customer
export const login = async (req, res, next) => {
  try {
    const { phoneOrEmail, password, otp, rememberMe } = req.body;

    // Find customer by email or phone
    const customer = await Customer.findOne({
      $or: [
        { email: phoneOrEmail },
        { mobile: phoneOrEmail }
      ]
    }).select('+password');

    if (!customer) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Check if password is correct
    const isPasswordCorrect = await customer.comparePassword(password);
    if (!isPasswordCorrect) {
      return next(new AppError('Invalid credentials', 401));
    }

    // If OTP is required (for password reset)
    if (otp) {
      if (!customer.resetPasswordOTP || customer.resetPasswordOTP !== otp) {
        return next(new AppError('Invalid OTP', 400));
      }
      if (Date.now() > customer.resetPasswordOTPExpiry) {
        return next(new AppError('OTP has expired', 400));
      }
      // Clear OTP after successful verification
      customer.resetPasswordOTP = undefined;
      customer.resetPasswordOTPExpiry = undefined;
    }

    // Update last login
    customer.lastLogin = Date.now();
    await customer.save();

    // Generate tokens with rememberMe setting
    const accessToken = customer.generateAuthToken(rememberMe);
    const refreshToken = customer.generateRefreshToken(rememberMe);

    // Set up session in Redis
    await setSession(customer._id.toString(), {
      user: {
        id: customer._id,
        role: 'customer',
        name: customer.name,
        email: customer.email
      },
      lastActivity: Date.now()
    });

    // Emit customer login event for real-time dashboard updates
    emitEvent(EVENT_TYPES.CUSTOMER_LOGIN, {
      customerId: customer._id,
      name: customer.name,
      email: customer.email
    });

    // Set cookie with the auth token
    // Calculate expiry time (default: 1 day, remember me: 30 days)
    const cookieExpiry = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    res.cookie('auth_token', accessToken, {
      httpOnly: true, // Make the cookie accessible only by the web server
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      sameSite: 'strict', // Prevent CSRF attacks
      maxAge: cookieExpiry, // Cookie expiry time in milliseconds
      path: '/' // Cookie is available for all paths
    });

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: rememberMe ? '30d' : '1d',
        user: customer
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Helper function to generate OTP
const generateOTPHelper = () => {
  const digits = process.env.OTP_LENGTH || 6;
  return Math.floor(Math.random() * Math.pow(10, digits)).toString().padStart(digits, '0');
};

// Send OTP
export const sendOTP = async (req, res, next) => {
  try {
    console.log('🔍 sendOTP called with:', req.body);

    const { phoneOrEmail, purpose } = req.body;

    // Check if customer exists
    const customer = await Customer.findOne({
      $or: [
        { email: phoneOrEmail },
        { mobile: phoneOrEmail }
      ]
    });

    // For verification purpose during registration, we shouldn't check if account exists
    if (purpose === 'verify' && !customer) {
      // Generate OTP for new registration
      const otp = generateOTPHelper();

      // Log OTP for development purposes
      console.log('\n=========== DEVELOPMENT OTP ===========');
      console.log(`📱 Phone/Email: ${phoneOrEmail}`);
      console.log(`🔐 OTP Generated: ${otp}`);
      console.log(`⏱️ Expires in: 10 minutes`);
      console.log('========================================\n');

      // Store OTP in Redis with a temporary key
      const tempKey = `temp_${phoneOrEmail}`;
      let otpStored = false;

      try {
        otpStored = await setOTP(tempKey, otp);
        console.log(`OTP Storage Status: ${otpStored ? 'Successfully Stored in Redis' : 'Redis Unavailable'}`);
      } catch (redisError) {
        console.log('Redis storage failed, using development fallback:', redisError.message);
      }

      // Fallback to in-memory storage if Redis is unavailable
      if (!otpStored) {
        global.devOtpCache = global.devOtpCache || new Map();
        global.devOtpCache.set(tempKey, {
          code: otp,
          expiry: Date.now() + (10 * 60 * 1000),
          attempts: 0
        });
        console.log('📝 OTP stored in development in-memory cache');
        otpStored = true;
      }

      // Send OTP via email or SMS
      let sendSuccess = false;
      let sendError = null;
      let serviceType = phoneOrEmail.includes('@') ? 'email' : 'sms';

      try {
        if (phoneOrEmail.includes('@')) {
          // Send Email OTP
          console.log('📧 Attempting to send OTP via email...');

          // Check if email service is available
          const emailConfig = {
            AWS_REGION: process.env.AWS_REGION,
            AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
            AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY
          };

          const hasEmailConfig = Object.values(emailConfig).every(value => value && value.trim() !== '');

          if (!hasEmailConfig) {
            throw new Error('Email service not configured (missing AWS credentials)');
          }

          await sendEmail({
            to: phoneOrEmail,
            subject: 'Verify Your Email - RocketryBox',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333;">Email Verification - RocketryBox</h2>
                <p>Thank you for registering with RocketryBox!</p>
                <p>Your email verification code is:</p>
                <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
                  <h1 style="color: #007bff; margin: 0; font-size: 36px; letter-spacing: 5px;">${otp}</h1>
                </div>
                <p>This code will expire in <strong>10 minutes</strong>.</p>
                <p>If you didn't request this verification, please ignore this email.</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">RocketryBox - Shipping & Logistics</p>
              </div>
            `,
            text: `Your RocketryBox email verification code is: ${otp}. This code will expire in 10 minutes. If you didn't request this, please ignore this email.`
          });
          console.log('✅ Email OTP sent successfully');
          sendSuccess = true;
        } else {
          // Send SMS OTP
          console.log('�� Attempting to send OTP via SMS...');

          // Check if SMS service is available
          if (!process.env.FAST2SMS_API_KEY || process.env.FAST2SMS_API_KEY.trim() === '') {
            throw new Error('SMS service not configured (missing Fast2SMS API key)');
          }

          await sendSMSOTP(phoneOrEmail, otp, 'registration', 10);
          console.log('✅ SMS OTP sent successfully');
          sendSuccess = true;
        }
      } catch (sendServiceError) {
        sendError = sendServiceError;
        console.error(`❌ Failed to send OTP via ${serviceType.toUpperCase()}:`, sendServiceError.message);

        // In development mode, gracefully handle service configuration issues
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔧 Development Mode: ${serviceType.toUpperCase()} service error, but OTP is stored for verification`);
          console.log(`🔧 You can use the OTP from console: ${otp}`);
          sendSuccess = true; // Allow development to proceed
        } else {
          // In production, service failures are critical
          return next(new AppError(`Failed to send OTP via ${serviceType}. Please try again later.`, 500));
        }
      }

      // Ensure OTP is stored (critical requirement)
      if (!otpStored) {
        return next(new AppError('Unable to store OTP. Please try again later.', 500));
      }

      return res.status(200).json({
        success: true,
        data: {
          message: sendSuccess && !sendError
            ? (phoneOrEmail.includes('@') ? 'Email OTP sent successfully' : 'SMS OTP sent successfully')
            : 'OTP generated successfully. Please check console for development OTP.',
          expiresIn: 600, // 10 minutes in seconds
          ...(process.env.NODE_ENV === 'development' && {
            developmentOtp: otp,
            services: {
              storage: otpStored ? 'Working' : 'Failed',
              delivery: sendSuccess && !sendError ? 'Sent' : 'Console-Only'
            },
            ...(sendError && { serviceError: sendError.message })
          })
        }
      });
    }

    // For login/reset purposes, we need an existing account
    if ((purpose === 'login' || purpose === 'reset') && !customer) {
      return next(new AppError('No account found with this email or phone number', 404));
    }

    // For existing customers (login/reset flow)
    const otp = generateOTPHelper();
    console.log('\n=========== DEVELOPMENT OTP ===========');
    console.log(`📱 Phone/Email: ${phoneOrEmail}`);
    console.log(`🔐 OTP Generated: ${otp}`);
    console.log('========================================\n');

    // Store OTP in Redis or fallback to memory
    const key = customer._id.toString();
    let otpStored = false;

    try {
      otpStored = await setOTP(key, otp);
      console.log(`OTP Storage Status: ${otpStored ? 'Successfully Stored in Redis' : 'Redis Unavailable'}`);
    } catch (redisError) {
      console.log('Redis storage failed:', redisError.message);
    }

    // Fallback to in-memory storage
    if (!otpStored) {
      global.devOtpCache = global.devOtpCache || new Map();
      global.devOtpCache.set(key, {
        code: otp,
        expiry: Date.now() + (10 * 60 * 1000),
        attempts: 0
      });
      console.log('📝 OTP stored in development in-memory cache');
      otpStored = true;
    }

    // Send OTP via email or SMS
    let sendSuccess = false;
    let sendError = null;
    let serviceType = phoneOrEmail.includes('@') ? 'email' : 'sms';

    try {
      if (phoneOrEmail.includes('@')) {
        await sendEmail({
          to: phoneOrEmail,
          subject: 'Login Verification - RocketryBox',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333;">Login Verification - RocketryBox</h2>
              <p>Hello ${customer.name},</p>
              <p>Your login verification code is:</p>
              <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
                <h1 style="color: #007bff; margin: 0; font-size: 36px; letter-spacing: 5px;">${otp}</h1>
              </div>
              <p>This code will expire in <strong>10 minutes</strong>.</p>
              <p>If you didn't request this, please contact our support team.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px;">RocketryBox - Shipping & Logistics</p>
            </div>
          `,
          text: `Hello ${customer.name}, your RocketryBox login verification code is: ${otp}. This code will expire in 10 minutes.`
        });
        sendSuccess = true;
      } else {
        await sendSMSOTP(phoneOrEmail, otp, 'login verification', 10);
        sendSuccess = true;
      }
    } catch (sendServiceError) {
      sendError = sendServiceError;
      console.error(`Send ${serviceType} error:`, sendServiceError.message);

      if (process.env.NODE_ENV === 'development') {
        console.log(`🔧 Development Mode: ${serviceType.toUpperCase()} error but proceeding`);
        sendSuccess = true;
      } else {
        return next(new AppError(`Failed to send OTP via ${serviceType}. Please try again later.`, 500));
      }
    }

    // Ensure OTP is stored (critical requirement)
    if (!otpStored) {
      return next(new AppError('Unable to store OTP. Please try again later.', 500));
    }

    res.status(200).json({
      success: true,
      data: {
        message: sendSuccess && !sendError
          ? (phoneOrEmail.includes('@') ? 'Email OTP sent successfully' : 'SMS OTP sent successfully')
          : 'OTP generated successfully. Please check console for development OTP.',
        expiresIn: 600, // 10 minutes in seconds
        ...(process.env.NODE_ENV === 'development' && {
          developmentOtp: otp,
          services: {
            storage: otpStored ? 'Working' : 'Failed',
            delivery: sendSuccess && !sendError ? 'Sent' : 'Console-Only'
          },
          ...(sendError && { serviceError: sendError.message })
        })
      }
    });
  } catch (error) {
    console.error('SendOTP Unexpected Error:', error);
    next(new AppError(error.message || 'Failed to send OTP. Please try again.', 500));
  }
};

// Verify OTP
export const verifyOTPHandler = async (req, res, next) => {
  try {
    const { phoneOrEmail, otp } = req.body;

    // Find customer
    const customer = await Customer.findOne({
      $or: [
        { email: phoneOrEmail },
        { mobile: phoneOrEmail }
      ]
    });

    if (!customer) {
      return next(new AppError('No account found with this email or phone number', 404));
    }

    // Verify OTP using Redis
    const result = await verifyOTP(customer._id.toString(), otp);

    if (!result.valid) {
      return next(new AppError(result.message, 400));
    }

    // Generate password reset token (valid for 1 hour)
    const resetToken = generateOTPHelper() + generateOTPHelper(); // 12 digit token
    const resetTokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour

    // Save reset token to customer
    customer.passwordResetToken = resetToken;
    customer.passwordResetTokenExpiry = resetTokenExpiry;
    await customer.save();

    // Create reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/customer/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(customer.email)}`;

    // Send password reset email
    try {
      await sendEmail({
        to: customer.email,
        subject: 'Reset Your Password - RocketryBox',
        html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333;">Reset Your Password</h2>
                        <p>Hello ${customer.name},</p>
                        <p>You have successfully verified your identity. Click the button below to reset your password:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
                        </div>
                        <p>Or copy and paste this link in your browser:</p>
                        <p style="word-break: break-all; color: #007bff;">${resetLink}</p>
                        <p><strong>This link will expire in 1 hour.</strong></p>
                        <p>If you didn't request this password reset, please ignore this email.</p>
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                        <p style="color: #666; font-size: 12px;">RocketryBox - Shipping & Logistics</p>
                    </div>
                `,
        text: `Hello ${customer.name},\n\nYou have successfully verified your identity. Please click the following link to reset your password:\n\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this password reset, please ignore this email.\n\nRocketryBox - Shipping & Logistics`
      });

      console.log('\n=========== PASSWORD RESET EMAIL SENT ===========');
      console.log(`📧 Email sent to: ${customer.email}`);
      console.log(`🔗 Reset link: ${resetLink}`);
      console.log(`⏱️ Expires in: 1 hour`);
      console.log('===============================================\n');

    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // In development mode, still return success but log the error
      if (process.env.NODE_ENV !== 'development') {
        return next(new AppError('Failed to send password reset email. Please try again.', 500));
      }
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'OTP verified successfully. A password reset link has been sent to your email.',
        resetTokenSent: true
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Reset Password
export const resetPassword = async (req, res, next) => {
  try {
    const { token, email, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!token || !email || !newPassword || !confirmPassword) {
      return next(new AppError('All fields are required', 400));
    }

    if (newPassword !== confirmPassword) {
      return next(new AppError('Passwords do not match', 400));
    }

    if (newPassword.length < 8) {
      return next(new AppError('Password must be at least 8 characters long', 400));
    }

    // Find customer with valid reset token
    const customer = await Customer.findOne({
      email: email,
      passwordResetToken: token,
      passwordResetTokenExpiry: { $gt: Date.now() }
    }).select('+passwordResetToken +passwordResetTokenExpiry');

    if (!customer) {
      return next(new AppError('Invalid or expired reset token', 400));
    }

    // Update password and clear reset token
    customer.password = newPassword;
    customer.passwordResetToken = undefined;
    customer.passwordResetTokenExpiry = undefined;
    await customer.save();

    console.log('\n=========== PASSWORD RESET SUCCESSFUL ===========');
    console.log(`📧 Password reset for: ${customer.email}`);
    console.log(`👤 Customer: ${customer.name}`);
    console.log('===============================================\n');

    res.status(200).json({
      success: true,
      data: {
        message: 'Password reset successfully. You can now login with your new password.'
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Check if user is authenticated
export const checkAuthStatus = async (req, res) => {
  try {
    // Check for auth token in headers or cookies
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
    }

    if (!token) {
      return res.status(200).json({
        success: false,
        message: 'Not authenticated',
        isAuthenticated: false
      });
    }

    // Verify token manually
    const jwt = (await import('jsonwebtoken')).default;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the customer
    const Customer = (await import('../../models/customer.model.js')).default;
    const customer = await Customer.findById(decoded.id);

    if (!customer) {
      return res.status(200).json({
        success: false,
        message: 'User not found',
        isAuthenticated: false
      });
    }

    // User is authenticated, return basic user info
    res.status(200).json({
      success: true,
      isAuthenticated: true,
      data: {
        user: {
          id: customer._id,
          name: customer.name,
          email: customer.email,
          role: 'customer'
        }
      }
    });
  } catch (error) {
    console.log('Auth check error:', error.message);
    res.status(200).json({
      success: false,
      message: 'Invalid token',
      isAuthenticated: false
    });
  }
};

// Logout customer
export const logout = async (req, res, next) => {
  try {
    // Get the customer ID from the request (set by the auth middleware)
    const customerId = req.user?.id;
    const isImpersonated = req.user?.isImpersonated;
    const impersonatedBy = req.user?.impersonatedBy;

    if (!customerId) {
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    }

    // If this is an impersonated session, clean up the impersonation
    if (isImpersonated && impersonatedBy) {
      console.log(`🔄 Cleaning up impersonated session for customer ${customerId} by admin ${impersonatedBy}`);

      try {
        // Delete impersonation session from Redis
        await deleteSession(`impersonation:${impersonatedBy}:${customerId}`);
        console.log('✅ Impersonation session deleted from Redis');
      } catch (redisError) {
        console.warn('⚠️ Failed to delete impersonation session from Redis:', redisError.message);
      }

      // Log the end of impersonation
      console.log(`🔚 Impersonation ended: Admin ${impersonatedBy} stopped impersonating customer ${customerId}`);

      // For impersonated sessions, we don't need to clear the customer's actual session
      // since this was not a real customer login
      return res.status(200).json({
        success: true,
        message: 'Impersonation session ended successfully',
        wasImpersonated: true
      });
    }

    // Handle regular customer logout (not impersonated)
    // Clear the auth token cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });

    // Delete the user's session from Redis for regular customers
    try {
      await deleteSession(customerId.toString());
      console.log('✅ Customer session deleted from Redis');
    } catch (redisError) {
      console.warn('⚠️ Failed to delete customer session from Redis:', redisError.message);
      // Don't fail logout if Redis is unavailable
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      wasImpersonated: false
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

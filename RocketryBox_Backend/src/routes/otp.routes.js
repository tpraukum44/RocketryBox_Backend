// OTP Routes - Email-based OTP verification for Customer/Seller Registration
// This will work seamlessly once AWS SES production access is approved

import { SendEmailCommand } from '@aws-sdk/client-ses';
import express from 'express';
import { AWS_CONFIG, sesClient } from '../config/aws.js';

const router = express.Router();

// In-memory OTP storage (use Redis or database in production)
const otpStore = new Map();

/**
 * Generate OTP for customer registration
 *
 * Route: POST /otp/send-customer-registration
 * Body: { email, name?, phone? }
 *
 * Sends OTP to customer email for registration verification
 */
router.post('/send-customer-registration', async (req, res) => {
  try {
    const { email, name, phone } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP (use Redis/database in production)
    otpStore.set(email, {
      otp,
      type: 'customer-registration',
      expiresAt,
      attempts: 0,
      name,
      phone
    });

    // Send OTP email
    const result = await sendOTPEmail(email, otp, name || 'Customer', 'customer registration');

    res.json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        email,
        expiresAt: expiresAt.toISOString(),
        messageId: result.MessageId,
        // Include OTP in development for testing
        ...(process.env.NODE_ENV === 'development' && { otp })
      }
    });

  } catch (error) {
    console.error('Error sending customer registration OTP:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send OTP',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Generate OTP for seller registration
 *
 * DISABLED: This route is now handled by /seller/auth/otp/send
 * to prevent duplicate OTP emails
 *
 * Route: POST /otp/send-seller-registration (DISABLED)
 * Body: { email, businessName?, contactName?, phone? }
 *
 * Sends OTP to seller email for registration verification
 */
router.post('/send-seller-registration-DISABLED', async (req, res) => {
  try {
    const { email, businessName, contactName, phone } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP
    otpStore.set(email, {
      otp,
      type: 'seller-registration',
      expiresAt,
      attempts: 0,
      businessName,
      contactName,
      phone
    });

    // Send OTP email
    const result = await sendOTPEmail(email, otp, contactName || businessName || 'Business Partner', 'seller registration');

    res.json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        email,
        expiresAt: expiresAt.toISOString(),
        messageId: result.MessageId,
        // Include OTP in development for testing
        ...(process.env.NODE_ENV === 'development' && { otp })
      }
    });

  } catch (error) {
    console.error('Error sending seller registration OTP:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send OTP',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Verify OTP
 *
 * Route: POST /otp/verify
 * Body: { email, otp }
 *
 * Verifies the OTP and returns success if valid
 */
router.post('/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Email and OTP are required'
      });
    }

    const stored = otpStore.get(email);

    if (!stored) {
      return res.status(400).json({
        success: false,
        error: 'No OTP found for this email'
      });
    }

    // Check expiration
    if (new Date() > stored.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({
        success: false,
        error: 'OTP has expired'
      });
    }

    // Check attempts
    if (stored.attempts >= 3) {
      otpStore.delete(email);
      return res.status(400).json({
        success: false,
        error: 'Too many failed attempts. Please request a new OTP'
      });
    }

    // Verify OTP
    if (stored.otp !== otp) {
      stored.attempts++;
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP',
        attemptsRemaining: 3 - stored.attempts
      });
    }

    // Success - OTP is valid
    const userData = {
      email,
      type: stored.type,
      verifiedAt: new Date().toISOString(),
      ...(stored.name && { name: stored.name }),
      ...(stored.businessName && { businessName: stored.businessName }),
      ...(stored.contactName && { contactName: stored.contactName }),
      ...(stored.phone && { phone: stored.phone })
    };

    // Remove OTP after successful verification
    otpStore.delete(email);

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: userData
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify OTP'
    });
  }
});

/**
 * Helper function to send OTP emails
 */
async function sendOTPEmail(email, otp, recipientName, registrationType) {
  const subject = `Your RocketryBox OTP - ${otp}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1>🚀 RocketryBox</h1>
        <p>Email Verification Required</p>
      </div>

      <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0;">
        <h2>Hello ${recipientName}!</h2>
        <p>Thank you for starting your ${registrationType} with RocketryBox. To complete the process, please verify your email address using the OTP below:</p>

        <div style="background: #f8f9fa; border: 2px dashed #667eea; padding: 30px; text-align: center; margin: 30px 0; border-radius: 8px;">
          <p style="margin: 0; font-size: 18px; color: #666;">Your OTP Code:</p>
          <div style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; margin: 10px 0;">${otp}</div>
          <p style="margin: 0; font-size: 14px; color: #666;">Valid for 10 minutes</p>
        </div>

        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0;">🔒 Security Information:</h4>
          <ul style="margin: 0; padding-left: 20px;">
            <li>This OTP will expire in 10 minutes</li>
            <li>Do not share this code with anyone</li>
            <li>If you didn't request this, please ignore this email</li>
            <li>Maximum 3 attempts allowed</li>
          </ul>
        </div>

        <p>If you have any questions, please contact our support team.</p>
        <p>Best regards,<br>The RocketryBox Team</p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; border-radius: 0 0 8px 8px;">
        <p>This email was sent from RocketryBox Registration System</p>
        <p>Email: ${email} | Type: ${registrationType}</p>
      </div>
    </div>
  `;

  const textContent = `
Hello ${recipientName}!

Thank you for starting your ${registrationType} with RocketryBox. To complete the process, please verify your email address using the OTP below:

Your OTP Code: ${otp}
Valid for: 10 minutes

Security Information:
- This OTP will expire in 10 minutes
- Do not share this code with anyone
- If you didn't request this, please ignore this email
- Maximum 3 attempts allowed

If you have any questions, please contact our support team.

Best regards,
The RocketryBox Team

---
This email was sent from RocketryBox Registration System
Email: ${email} | Type: ${registrationType}
  `;

  const command = new SendEmailCommand({
    Source: AWS_CONFIG.sesSenderEmail,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: htmlContent, Charset: 'UTF-8' },
        Text: { Data: textContent, Charset: 'UTF-8' }
      }
    }
  });

  return await sesClient.send(command);
}

/**
 * USAGE EXAMPLES (After SES Production Access):
 *
 * 1. Customer Registration:
 *    POST /api/v2/otp/send-customer-registration
 *    { "email": "customer@gmail.com", "name": "John Doe" }
 *
 * 2. Seller Registration (DISABLED - Use /api/v2/seller/auth/otp/send instead):
 *    POST /api/v2/otp/send-seller-registration-DISABLED
 *    { "email": "business@company.com", "businessName": "ABC Corp", "contactName": "Jane Smith" }
 *
 * 3. Verify OTP:
 *    POST /api/v2/otp/verify
 *    { "email": "customer@gmail.com", "otp": "123456" }
 *
 * IMPORTANT:
 * - Works with ANY email address once SES production access is approved
 * - No need to manually verify each customer/seller email
 * - Perfect for scalable registration system
 */

export default router;

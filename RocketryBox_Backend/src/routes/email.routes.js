// Email Routes - AWS SES Integration for Sending Emails
// This handles sending emails using SES with EC2 IAM role credentials

import { SendEmailCommand } from '@aws-sdk/client-ses';
import express from 'express';
import { AWS_CONFIG, sesClient } from '../config/aws.js';

const router = express.Router();

/**
 * Send verification email using AWS SES
 *
 * Route: POST /email/send-verification
 * Body Parameters:
 *   - email: Recipient email address (required)
 *   - name: Recipient name (optional)
 *   - userId: User ID for tracking (optional)
 *
 * Sends a professional verification email with a verification code
 */
router.post('/send-verification', async (req, res) => {
  try {
    const { email, name, userId } = req.body;

    // Validate required parameters
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'email is required'
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Generate a verification code (6 digits)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create email content
    const recipientName = name || 'User';
    const emailSubject = 'Verify Your Email - RocketryBox';

    // HTML email template
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; }
          .verification-code { background: #f8f9fa; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px; }
          .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 4px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 RocketryBox</h1>
            <p>Email Verification Required</p>
          </div>

          <div class="content">
            <h2>Hello ${recipientName}!</h2>
            <p>Thank you for signing up with RocketryBox. To complete your registration, please verify your email address using the verification code below:</p>

            <div class="verification-code">
              <p><strong>Your Verification Code:</strong></p>
              <div class="code">${verificationCode}</div>
            </div>

            <p><strong>Important:</strong></p>
            <ul>
              <li>This code will expire in 15 minutes</li>
              <li>Enter this code exactly as shown (case-sensitive)</li>
              <li>If you didn't request this verification, please ignore this email</li>
            </ul>

            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>

            <p>Best regards,<br>The RocketryBox Team</p>
          </div>

          <div class="footer">
            <p>This email was sent from RocketryBox Email Service</p>
            <p>If you received this email by mistake, please ignore it.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Plain text version (fallback)
    const textBody = `
      Hello ${recipientName}!

      Thank you for signing up with RocketryBox. To complete your registration, please verify your email address using the verification code below:

      Your Verification Code: ${verificationCode}

      Important:
      - This code will expire in 15 minutes
      - Enter this code exactly as shown (case-sensitive)
      - If you didn't request this verification, please ignore this email

      If you have any questions or need assistance, please contact our support team.

      Best regards,
      The RocketryBox Team

      ---
      This email was sent from RocketryBox Email Service
      If you received this email by mistake, please ignore it.
    `;

    // Create SES send email command
    const sendEmailCommand = new SendEmailCommand({
      Source: AWS_CONFIG.sesSenderEmail, // Must be verified in SES
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Subject: {
          Data: emailSubject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8'
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8'
          }
        }
      },
      // Optional: Add tags for tracking and organization
      Tags: [
        {
          Name: 'EmailType',
          Value: 'verification'
        },
        {
          Name: 'UserId',
          Value: userId || 'unknown'
        },
        {
          Name: 'Timestamp',
          Value: new Date().toISOString().replace(/[^a-zA-Z0-9_.-]/g, '_')
        }
      ]
    });

    // Send the email
    const result = await sesClient.send(sendEmailCommand);

    // Log successful send (don't log the verification code in production)
    console.log(`✅ Verification email sent to ${email}, MessageId: ${result.MessageId}`);

    res.json({
      success: true,
      message: 'Verification email sent successfully',
      data: {
        messageId: result.MessageId,
        recipient: email,
        sentAt: new Date().toISOString(),
        // In development, include the verification code for testing
        ...(process.env.NODE_ENV === 'development' && { verificationCode })
      }
    });

  } catch (error) {
    console.error('Error sending verification email:', error);

    // Handle specific SES errors
    let errorMessage = 'Failed to send verification email';
    if (error.name === 'MessageRejected') {
      errorMessage = 'Email address is not verified or invalid';
    } else if (error.name === 'SendingPausedException') {
      errorMessage = 'Email sending is currently paused for this account';
    } else if (error.name === 'MailFromDomainNotVerifiedException') {
      errorMessage = 'Sender email domain is not verified';
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Send custom email (for other use cases)
 *
 * Route: POST /email/send-custom
 * Body Parameters:
 *   - to: Recipient email address (required)
 *   - subject: Email subject (required)
 *   - htmlContent: HTML email content (required)
 *   - textContent: Plain text content (optional)
 *   - from: Sender email address (optional, defaults to SES_SENDER_EMAIL)
 *
 * Sends a custom email with provided content
 */
router.post('/send-custom', async (req, res) => {
  try {
    const { to, subject, htmlContent, textContent, from } = req.body;

    // Validate required parameters
    if (!to || !subject || !htmlContent) {
      return res.status(400).json({
        success: false,
        error: 'to, subject, and htmlContent are required'
      });
    }

    // Basic email validation for recipient
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recipient email format'
      });
    }

    // Validate sender email if provided
    const senderEmail = from || AWS_CONFIG.sesSenderEmail;
    if (from && !emailRegex.test(from)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sender email format'
      });
    }

    // Create SES send email command
    const sendEmailCommand = new SendEmailCommand({
      Source: senderEmail,
      Destination: {
        ToAddresses: [to]
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlContent,
            Charset: 'UTF-8'
          },
          ...(textContent && {
            Text: {
              Data: textContent,
              Charset: 'UTF-8'
            }
          })
        }
      }
    });

    // Send the email
    const result = await sesClient.send(sendEmailCommand);

    console.log(`✅ Custom email sent from ${senderEmail} to ${to}, MessageId: ${result.MessageId}`);

    res.json({
      success: true,
      message: 'Email sent successfully',
      data: {
        messageId: result.MessageId,
        sender: senderEmail,
        recipient: to,
        sentAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error sending custom email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send email',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * IMPORTANT NOTES FOR AWS SES:
 *
 * 1. Email Address Verification:
 *    - In SES Sandbox mode, both sender and recipient emails must be verified
 *    - In Production mode, only sender email/domain needs to be verified
 *    - Verify emails in AWS SES Console before testing
 *
 * 2. Sending Limits:
 *    - Sandbox: 200 emails per day, 1 email per second
 *    - Production: Higher limits, can be increased via AWS support
 *    - Monitor your sending quota in AWS Console
 *
 * 3. IAM Role Permissions Required:
 *    - ses:SendEmail
 *    - ses:SendRawEmail
 *    - ses:GetSendQuota (optional, for monitoring)
 *
 * 4. Best Practices:
 *    - Always include both HTML and text versions
 *    - Use proper email templates
 *    - Handle bounces and complaints
 *    - Monitor your reputation
 */

export default router;

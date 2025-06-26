import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { logger } from './logger.js';

// Debug log AWS environment variables (without sensitive values)
logger.info('Checking AWS environment variables:', {
  AWS_REGION: process.env.AWS_REGION ? 'Set' : 'Not set',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not set',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? 'Set' : 'Not set',
  SES_FROM_EMAIL: 'admin@rocketrybox.com (hardcoded)',
  NODE_ENV: process.env.NODE_ENV
});

// Create SES client
let sesClient = null;

const initializeSESClient = () => {
  try {
    // Check if required environment variables are present
    if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      // Don't log error - AWS email is optional
      logger.info('AWS Email service not configured (optional). Email functionality will be disabled.');
      return false;
    }

    // Validate AWS credentials format
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY.trim();
    const region = process.env.AWS_REGION.trim();

    // Validate region format
    if (!region.match(/^[a-z]{2}-[a-z]+-\d{1}$/)) {
      logger.error('Invalid AWS Region format. Expected format: xx-xxxxx-x (e.g., ap-south-1)');
      return false;
    }

    // Log detailed region information
    logger.info('AWS Region details:', {
      region,
      format: region.match(/^[a-z]{2}-[a-z]+-\d{1}$/) ? 'Valid' : 'Invalid',
      expectedFormat: 'xx-xxxxx-x (e.g., ap-south-1)'
    });

    if (!accessKeyId.match(/^[A-Z0-9]{20}$/)) {
      logger.error('Invalid AWS Access Key ID format');
      return false;
    }

    if (!secretAccessKey.match(/^[A-Za-z0-9/+=]{40}$/)) {
      logger.error('Invalid AWS Secret Access Key format');
      return false;
    }

    // Log AWS region and credentials presence (without sensitive data)
    logger.info('Initializing AWS SES client with:', {
      region,
      hasAccessKey: true,
      hasSecretKey: true,
      fromEmail: 'admin@rocketrybox.com'
    });

    // Create SES client with explicit credentials and additional configuration
    sesClient = new SESClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      },
      maxAttempts: 3,
      endpoint: `https://email.${region}.amazonaws.com`,
      forcePathStyle: false,
      signatureVersion: 'v4'
    });

    logger.info('AWS SES client initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize AWS SES client:', {
      error: error.message,
      stack: error.stack,
      region: process.env.AWS_REGION
    });
    sesClient = null;
    return false;
  }
};

// Initialize the client immediately
initializeSESClient();

/**
 * Send email using AWS SES
 * @param {Object} params
 * @param {string|string[]} params.to - Email recipient(s)
 * @param {string} params.subject - Email subject
 * @param {string} [params.text] - Plain text content
 * @param {string} [params.html] - HTML content
 * @param {string} [params.templateId] - Template ID for template-based emails
 * @param {Object} [params.variables] - Variables for template-based emails
 */
export const sendEmail = async ({ to, subject, text, html, templateId, variables }) => {
  try {
    // Try to reinitialize the client if it's not available
    if (!sesClient && !initializeSESClient()) {
      throw new Error('AWS SES client not initialized. Please check your AWS credentials.');
    }

    // Validate recipient email
    if (!to) {
      throw new Error('Recipient email is required');
    }

    // Prepare content based on template or direct content
    let finalHtml = html;
    let finalText = text;
    let finalSubject = subject;

    if (templateId && EMAIL_TEMPLATES[templateId]) {
      const template = EMAIL_TEMPLATES[templateId];
      finalHtml = template.html;
      finalText = template.text;
      finalSubject = template.subject;

      // Replace variables in template
      if (variables) {
        Object.keys(variables).forEach(key => {
          const value = variables[key] || '';
          finalHtml = finalHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
          finalText = finalText.replace(new RegExp(`{{${key}}}`, 'g'), value);
          finalSubject = finalSubject.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });

        // Handle Super Admin conditional sections
        if (variables.isSuperAdmin) {
          // Show Super Admin sections
          finalHtml = finalHtml.replace(/{{#if isSuperAdmin}}([\s\S]*?){{\/if}}/g, '$1');
          finalText = finalText.replace(/{{#if isSuperAdmin}}([\s\S]*?){{\/if}}/g, '$1');
        } else {
          // Remove Super Admin sections
          finalHtml = finalHtml.replace(/{{#if isSuperAdmin}}([\s\S]*?){{\/if}}/g, '');
          finalText = finalText.replace(/{{#if isSuperAdmin}}([\s\S]*?){{\/if}}/g, '');
        }
      }
    }

    // Validate that we have a subject after template processing
    if (!finalSubject) {
      throw new Error('Email subject is required');
    }

    const params = {
      Source: 'admin@rocketrybox.com', // Hardcoded SES sender email
      Destination: {
        ToAddresses: Array.isArray(to) ? to.map(email => email.trim()) : [to.trim()]
      },
      Message: {
        Subject: {
          Data: finalSubject,
          Charset: 'UTF-8'
        },
        Body: {
          ...(finalHtml && {
            Html: {
              Data: finalHtml,
              Charset: 'UTF-8'
            }
          }),
          ...(finalText && {
            Text: {
              Data: finalText,
              Charset: 'UTF-8'
            }
          })
        }
      }
    };

    const command = new SendEmailCommand(params);
    const result = await sesClient.send(command);

    return {
      success: true,
      messageId: result.MessageId,
      message: 'Email sent successfully'
    };
  } catch (error) {
    logger.error('Email sending failed:', {
      error: error.message,
      code: error.code,
      recipient: to,
      subject
    });
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// Predefined email templates
export const EMAIL_TEMPLATES = {
  'admin-invitation': {
    subject: 'Welcome to {{platformName}} - Your Admin Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1; margin: 0; font-size: 28px;">{{platformName}}</h1>
            <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 14px;">Admin Portal</p>
          </div>

          <!-- Welcome Message -->
          <div style="margin-bottom: 25px;">
            <h2 style="color: #374151; margin: 0 0 10px 0;">Welcome to the Team, {{name}}! 🎉</h2>
            <p style="color: #6b7280; margin: 0; line-height: 1.6;">
              Your admin account has been successfully created. You can now access the {{platformName}} admin panel with the credentials below.
            </p>
          </div>

          <!-- Role Information -->
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 16px;">Your Account Information</h3>
            <table style="width: 100%; border-spacing: 0;">
              <tr>
                <td style="padding: 5px 0; color: #6b7280; font-weight: 600;">Employee ID:</td>
                <td style="padding: 5px 0; color: #374151; font-weight: bold;">{{employeeId}}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #6b7280; font-weight: 600;">Role:</td>
                <td style="padding: 5px 0; color: #374151;">{{role}}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #6b7280; font-weight: 600;">Department:</td>
                <td style="padding: 5px 0; color: #374151;">{{department}}</td>
              </tr>
            </table>
          </div>

          {{#if isSuperAdmin}}
          <!-- Super Admin Privileges Alert -->
          <div style="background-color: #fed7d7; border: 2px solid #f56565; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #c53030; margin: 0 0 15px 0; font-size: 16px;">⚡ Super Admin Privileges Granted</h3>
            <p style="color: #c53030; margin: 0 0 10px 0; font-weight: 600;">
              You have been granted Super Admin access with the following capabilities:
            </p>
            <ul style="color: #c53030; margin: 0; padding-left: 20px; line-height: 1.6;">
              <li>Create and manage other admin accounts</li>
              <li>Access all system configurations</li>
              <li>Modify critical platform settings</li>
              <li>Override security restrictions</li>
              <li>Full database and user management</li>
            </ul>
            <p style="color: #c53030; margin: 10px 0 0 0; font-size: 12px; font-weight: 600;">
              ⚠️ With great power comes great responsibility. Use these privileges wisely.
            </p>
          </div>
          {{/if}}

          <!-- Login Credentials -->
          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 16px;">🔐 Your Login Credentials</h3>
            <table style="width: 100%; border-spacing: 0;">
              <tr>
                <td style="padding: 5px 0; color: #92400e; font-weight: 600;">Email:</td>
                <td style="padding: 5px 0; color: #92400e; font-family: monospace; background-color: #fff; padding: 5px 8px; border-radius: 4px;">{{email}}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #92400e; font-weight: 600;">Password:</td>
                <td style="padding: 5px 0; color: #92400e; font-family: monospace; background-color: #fff; padding: 5px 8px; border-radius: 4px; font-weight: bold;">{{password}}</td>
              </tr>
            </table>
            <p style="color: #92400e; margin: 10px 0 0 0; font-size: 12px;">
              🔒 Please keep your credentials secure and change your password after first login if required.
            </p>
          </div>

          <!-- Account Verification (Optional) -->
          <div style="background-color: #dbeafe; border: 1px solid #3b82f6; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 16px;">📧 Account Verification (Optional)</h3>
            <p style="color: #1e40af; margin: 0 0 10px 0;">
              Your verification OTP: <strong style="font-family: monospace; background-color: #fff; padding: 3px 6px; border-radius: 4px;">{{otp}}</strong>
            </p>
            <p style="color: #1e40af; margin: 0 0 15px 0; font-size: 14px;">
              You can use this OTP if additional verification is required (valid for 30 minutes).
            </p>
            <a href="{{verificationLink}}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: 600;">
              Verify Account
            </a>
          </div>

          <!-- Login Button -->
          <div style="text-align: center; margin-bottom: 25px;">
            <a href="{{loginUrl}}" style="display: inline-block; background-color: #6366f1; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Access Admin Portal
            </a>
          </div>

          <!-- Getting Started -->
          <div style="background-color: #f0fdf4; border: 1px solid #22c55e; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 16px;">🚀 Getting Started</h3>
            <ul style="color: #166534; margin: 0; padding-left: 20px; line-height: 1.6;">
              <li>Log in using your provided credentials</li>
              <li>Complete your profile information</li>
              <li>Familiarize yourself with your assigned permissions</li>
              <li>Change your password if required by your organization</li>
              <li>Contact your administrator if you need assistance</li>
            </ul>
          </div>

          <!-- Support Information -->
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center;">
            <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 14px;">
              Need help? Contact your administrator or our support team.
            </p>
            <p style="color: #6b7280; margin: 0; font-size: 12px;">
              Admin Portal: <a href="{{adminPortalUrl}}" style="color: #6366f1;">{{adminPortalUrl}}</a>
            </p>
          </div>

          <!-- Footer -->
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              This is an automated message from {{platformName}}. Please do not reply to this email.
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0;">
              © 2024 {{platformName}}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `,
    text: `
Welcome to {{platformName}}, {{name}}!

Your admin account has been successfully created.

ACCOUNT INFORMATION:
Employee ID: {{employeeId}}
Role: {{role}}
Department: {{department}}

{{#if isSuperAdmin}}
⚡ SUPER ADMIN PRIVILEGES GRANTED ⚡

You have been granted Super Admin access with the following capabilities:
- Create and manage other admin accounts
- Access all system configurations
- Modify critical platform settings
- Override security restrictions
- Full database and user management

⚠️ With great power comes great responsibility. Use these privileges wisely.

{{/if}}
LOGIN CREDENTIALS:
Email: {{email}}
Password: {{password}}

Admin Portal Login: {{loginUrl}}

VERIFICATION (Optional):
Your OTP: {{otp}} (valid for 30 minutes)
Verification Link: {{verificationLink}}

GETTING STARTED:
1. Log in using your provided credentials
2. Complete your profile information
3. Familiarize yourself with your assigned permissions
4. Change your password if required by your organization
5. Contact your administrator if you need assistance

Need help? Contact your administrator.
Admin Portal: {{adminPortalUrl}}

This is an automated message from {{platformName}}. Please do not reply.
    `
  },
  'password-reset': {
    subject: 'Password Reset OTP - Rocketry Box Admin',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello {{name}},</p>
        <p>You have requested to reset your password. Please use the OTP below:</p>
        <p style="font-size: 24px; font-weight: bold; color: #007bff;">{{otp}}</p>
        <p>This OTP is valid for 15 minutes.</p>
        <p>You can also use this direct link: <a href="{{resetLink}}">Reset Password</a></p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is an automated message, please do not reply to this email.
        </p>
      </div>
    `,
    text: `Hello {{name}}, you requested a password reset. Your OTP: {{otp}} (valid for 15 minutes). Reset link: {{resetLink}}`
  },
  OTP: {
    subject: 'Your OTP for RocketryBox',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your OTP for RocketryBox</h2>
        <p>Your OTP is: <strong>{{otp}}</strong></p>
        <p>This OTP will expire in {{expiry}}.</p>
        <p>Please do not share this OTP with anyone.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is an automated message, please do not reply to this email.
        </p>
      </div>
    `,
    text: `Your OTP for RocketryBox is {{otp}}. Valid for {{expiry}}. Do not share this OTP with anyone.`
  },
  ORDER_CONFIRMATION: {
    subject: 'Order Confirmation - RocketryBox',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Order Confirmation</h2>
        <p>Thank you for your order!</p>
        <p>Order ID: <strong>{{orderId}}</strong></p>
        <p>Tracking ID: <strong>{{trackingId}}</strong></p>
        <p>You can track your shipment using the tracking ID above.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is an automated message, please do not reply to this email.
        </p>
      </div>
    `,
    text: `Thank you for your order! Order ID: {{orderId}}, Tracking ID: {{trackingId}}. Track your shipment using the tracking ID.`
  },
  DELIVERY_CONFIRMATION: {
    subject: 'Order Delivered - RocketryBox',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Order Delivered</h2>
        <p>Your order has been delivered!</p>
        <p>Order ID: <strong>{{orderId}}</strong></p>
        <p>Thank you for using RocketryBox!</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is an automated message, please do not reply to this email.
        </p>
      </div>
    `,
    text: `Your order has been delivered! Order ID: {{orderId}}. Thank you for using RocketryBox!`
  },
  PAYMENT_CONFIRMATION: {
    subject: 'Payment Confirmation - RocketryBox',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Confirmation</h2>
        <p>Payment received successfully!</p>
        <p>Order ID: <strong>{{orderId}}</strong></p>
        <p>Amount: <strong>₹{{amount}}</strong></p>
        <p>Thank you for using RocketryBox!</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is an automated message, please do not reply to this email.
        </p>
      </div>
    `,
    text: `Payment of ₹{{amount}} received for order #{{orderId}}. Thank you for using RocketryBox!`
  }
};

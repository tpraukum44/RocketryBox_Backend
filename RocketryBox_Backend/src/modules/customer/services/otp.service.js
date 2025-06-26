import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { generateOTP } from '../../../utils/otp.js';
import { setOTP, getOTP } from '../../../utils/redis.js';
import { sendSMS } from '../../../utils/sms.js';
import { sendEmail } from '../../../utils/email.js';
import { logger } from '../../../utils/logger.js';

// Initialize AWS SES client
const sesClient = new SESClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Send OTP via SMS using Fast2SMS
const sendSMSOTP = async (mobile, otp) => {
    try {
        console.log('Attempting to send SMS OTP to:', mobile);
        
        // Validate mobile number
        if (!mobile || mobile.length !== 10) {
            console.error('Invalid mobile number:', mobile);
            return false;
        }

        // In development mode, always return success
        if (process.env.NODE_ENV === 'development') {
            console.log('Development mode: Returning dummy OTP:', otp);
            return true;
        }

        // Validate Fast2SMS API key
        if (!process.env.FAST2SMS_API_KEY) {
            console.error('Fast2SMS API key is not configured');
            return false;
        }

        // Send OTP using SMS service
        const result = await sendSMS({
            to: mobile,
            templateId: 'OTP',
            variables: {
                otp: otp,
                expiry: '5 minutes'
            }
        });

        return result.success;
    } catch (error) {
        console.error('SMS OTP Error:', error.message);
        return process.env.NODE_ENV === 'development'; // Return true in development, false otherwise
    }
};

// Send OTP via Email using AWS SES
const sendEmailOTP = async (email, otp) => {
    try {
        logger.info('Attempting to send Email OTP:', { 
            email,
            hasOTP: !!otp,
            sesClient: !!sesClient
        });
        
        // Validate email format
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            logger.error('Invalid email format:', { email });
            return false;
        }

        if (!sesClient) {
            logger.error('AWS SES client not initialized');
            return false;
        }

        const result = await sendEmail({
            to: email,
            subject: 'Your RocketryBox Verification Code',
            templateId: 'OTP',
            variables: {
                otp,
                expiry: '5 minutes'
            }
        });

        logger.info('Email OTP sent successfully:', { 
            email,
            messageId: result.messageId 
        });
        return true;
    } catch (error) {
        logger.error('Email OTP Error:', {
            email,
            error: error.message,
            stack: error.stack,
            sesClient: !!sesClient
        });
        return false;
    }
};

// Generate and send mobile OTP
const generateAndSendMobileOTP = async (mobile) => {
    try {
        console.log('\n=== Mobile OTP Generation ===');
        console.log('Mobile:', mobile);
        const otp = generateOTP();
        
        // Make OTP clearly visible in development mode
        if (process.env.NODE_ENV === 'development') {
            console.log('\n🔑 DEVELOPMENT MODE - MOBILE OTP 🔑');
            console.log('┌─────────────────────────────────┐');
            console.log(`│  Mobile: ${mobile.padEnd(25)}│`);
            console.log(`│  OTP: ${otp.padEnd(28)}│`);
            console.log('└─────────────────────────────────┘\n');
        } else {
            console.log('Generated OTP:', otp);
        }
        
        // Store OTP in Redis or memory store
        const stored = await setOTP(`mobile:${mobile}`, otp);
        console.log('OTP stored:', stored);
        
        if (!stored) {
            console.error('Failed to store OTP');
            return false;
        }
        
        // In development mode, always return success
        if (process.env.NODE_ENV === 'development') {
            console.log('Development mode: Returning dummy OTP:', otp);
            return true;
        }

        // Validate Fast2SMS API key
        if (!process.env.FAST2SMS_API_KEY) {
            console.error('Fast2SMS API key is not configured');
            return false;
        }

        // Send OTP using SMS service
        const result = await sendSMS({
            to: mobile,
            templateId: 'OTP',
            variables: {
                otp: otp,
                expiry: '5 minutes'
            }
        });

        console.log('SMS OTP sent:', result.success);
        console.log('=== End Mobile OTP ===\n');
        
        return result.success;
    } catch (error) {
        console.error('Error in generateAndSendMobileOTP:', error);
        return process.env.NODE_ENV === 'development'; // Return true in development, false otherwise
    }
};

// Generate and send email OTP
const generateAndSendEmailOTP = async (email) => {
    try {
        console.log('\n=== Email OTP Generation ===');
        console.log('Email:', email);
        const otp = generateOTP();
        
        // Make OTP clearly visible in development mode
        if (process.env.NODE_ENV === 'development') {
            console.log('\n📧 DEVELOPMENT MODE - EMAIL OTP 📧');
            console.log('┌─────────────────────────────────────────────┐');
            console.log(`│  Email: ${email.padEnd(38)}│`);
            console.log(`│  OTP: ${otp.padEnd(41)}│`);
            console.log('└─────────────────────────────────────────────┘\n');
        } else {
            console.log('Generated OTP:', otp);
        }
        
        const stored = await setOTP(`email:${email}`, otp);
        console.log('OTP stored in Redis:', stored);
        
        if (!stored) {
            console.error('Failed to store OTP in Redis');
            return false;
        }
        
        // In development mode, always return success
        if (process.env.NODE_ENV === 'development') {
            console.log('Development mode: Email OTP sending bypassed');
            return true;
        }
        
        const sent = await sendEmailOTP(email, otp);
        console.log('Email OTP sent:', sent);
        console.log('=== End Email OTP ===\n');
        
        return sent;
    } catch (error) {
        console.error('Error in generateAndSendEmailOTP:', {
            email,
            error: error.message,
            stack: error.stack
        });
        
        // Return success in development mode
        if (process.env.NODE_ENV === 'development') {
            return true;
        }
        return false;
    }
};

// Verify mobile OTP
const verifyMobileOTP = async (mobile, otp) => {
    const storedOTP = await getOTP(`mobile:${mobile}`);
    if (!storedOTP) return false;
    return storedOTP === otp;
};

// Verify email OTP
const verifyEmailOTP = async (email, otp) => {
    const storedOTP = await getOTP(`email:${email}`);
    if (!storedOTP) return false;
    return storedOTP === otp;
};

export {
    generateAndSendMobileOTP,
    generateAndSendEmailOTP,
    verifyMobileOTP,
    verifyEmailOTP,
}; 
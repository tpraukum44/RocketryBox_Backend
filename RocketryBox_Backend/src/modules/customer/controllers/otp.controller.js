import * as otpService from '../services/otp.service.js';
import { logger } from '../../../utils/logger.js';

// Send mobile OTP
const sendMobileOTP = async (req, res) => {
    try {
        logger.info('Received mobile OTP request:', { body: req.body });
        const { mobile } = req.body;

        // Validate mobile number
        if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
            logger.warn('Invalid mobile number format:', { mobile });
            return res.status(400).json({
                success: false,
                message: 'Invalid mobile number format',
            });
        }

        logger.info('Sending mobile OTP to:', { mobile });
        const success = await otpService.generateAndSendMobileOTP(mobile);

        if (success) {
            logger.info('Mobile OTP sent successfully:', { mobile });
            return res.status(200).json({
                success: true,
                message: 'OTP sent successfully',
            });
        } else {
            logger.error('Failed to send mobile OTP:', { mobile });
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP',
            });
        }
    } catch (error) {
        logger.error('Send Mobile OTP Error:', { error: error.message, stack: error.stack });
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};

// Send email OTP
const sendEmailOTP = async (req, res) => {
    try {
        const { email } = req.body;

        // Validate email
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            logger.warn('Invalid email format:', { email });
            return res.status(400).json({
                success: false,
                message: 'Invalid email format',
            });
        }

        logger.info('Sending email OTP to:', { email });
        const success = await otpService.generateAndSendEmailOTP(email);

        if (success) {
            logger.info('Email OTP sent successfully:', { email });
            return res.status(200).json({
                success: true,
                message: 'OTP sent successfully',
            });
        } else {
            logger.error('Failed to send email OTP:', { email });
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP. Please try again later.',
            });
        }
    } catch (error) {
        logger.error('Send Email OTP Error:', {
            error: error.message,
            stack: error.stack,
            body: req.body
        });
        return res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.',
        });
    }
};

// Verify mobile OTP
const verifyMobileOTP = async (req, res) => {
    try {
        const { mobile, otp } = req.body;

        if (!mobile || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number and OTP are required',
            });
        }

        const isValid = await otpService.verifyMobileOTP(mobile, otp);

        return res.status(200).json({
            success: true,
            isValid,
            message: isValid ? 'OTP verified successfully' : 'Invalid OTP',
        });
    } catch (error) {
        console.error('Verify Mobile OTP Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};

// Verify email OTP
const verifyEmailOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required',
            });
        }

        const isValid = await otpService.verifyEmailOTP(email, otp);

        return res.status(200).json({
            success: true,
            isValid,
            message: isValid ? 'OTP verified successfully' : 'Invalid OTP',
        });
    } catch (error) {
        console.error('Verify Email OTP Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};

export {
    sendMobileOTP,
    sendEmailOTP,
    verifyMobileOTP,
    verifyEmailOTP,
}; 
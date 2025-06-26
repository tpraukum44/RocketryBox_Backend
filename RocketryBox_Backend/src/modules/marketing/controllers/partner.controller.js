import Partner from '../models/partner.model.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { sendEmail } from '../../../utils/email.js';
import { sendSMS, SMS_TEMPLATES } from '../../../utils/sms.js';

export const registerPartner = async (req, res, next) => {
  try {
    const {
      fullName,
      companyName,
      email,
      contact,
      address,
      service,
      business,
      timeframe
    } = req.body;

    const partner = await Partner.create({
      fullName,
      companyName,
      email,
      contact,
      address,
      service,
      business,
      timeframe
    });

    // Send notification email to admin using AWS SES
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: 'New Partner Registration',
      text: `New partner registration from ${companyName}:\n\nName: ${fullName}\nEmail: ${email}\nContact: ${contact}\nAddress: ${address}\nService: ${service}\nBusiness: ${business}\nTimeframe: ${timeframe}`
    });

    // Send confirmation email to partner using AWS SES
    await sendEmail({
      to: email,
      subject: 'Partner Registration Received - RocketryBox',
      text: `Thank you for your interest in becoming a partner with RocketryBox. We have received your application and will review it shortly.`
    });

    // Send SMS confirmation to partner
    await sendSMS({
      to: contact,
      templateId: SMS_TEMPLATES.PARTNER_STATUS.templateId,
      variables: {
        status: 'received',
        companyName: companyName
      }
    });

    res.status(201).json({
      success: true,
      message: 'Partner registration successful',
      data: partner
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Admin endpoints
export const getAllPartners = async (req, res, next) => {
  try {
    const partners = await Partner.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: partners.length,
      data: partners
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

export const updatePartnerStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const partner = await Partner.findById(req.params.id);

    if (!partner) {
      return next(new AppError('Partner not found', 404));
    }

    partner.status = status;
    await partner.save();

    // Send status update email to partner using AWS SES
    await sendEmail({
      to: partner.email,
      subject: 'Partner Application Status Update - RocketryBox',
      text: `Your partner application status has been updated to: ${status}`
    });

    // Send SMS notification to partner
    await sendSMS({
      to: partner.contact,
      templateId: SMS_TEMPLATES.PARTNER_STATUS.templateId,
      variables: {
        status: status,
        companyName: partner.companyName
      }
    });

    res.status(200).json({
      success: true,
      data: partner
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
}; 
import Contact from '../models/contact.model.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { sendEmail } from '../../../utils/email.js';

export const submitContact = async (req, res, next) => {
  try {
    const { email, message } = req.body;

    const contact = await Contact.create({
      email,
      message
    });

    // Send notification email to admin
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: 'New Contact Form Submission',
      text: `New contact form submission from ${email}:\n\n${message}`
    });

    // Send confirmation email to user
    await sendEmail({
      to: email,
      subject: 'Thank you for contacting RocketryBox',
      text: 'We have received your message and will get back to you soon.'
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: contact
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Admin endpoints
export const getAllContacts = async (req, res, next) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

export const getContactById = async (req, res, next) => {
  try {
    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      return next(new AppError('Contact not found', 404));
    }

    res.status(200).json({
      success: true,
      data: contact
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
}; 
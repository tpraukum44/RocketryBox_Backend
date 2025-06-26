import Tracking from '../models/tracking.model.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { sendEmail } from '../../../utils/email.js';

export const getTrackingInfo = async (req, res, next) => {
  try {
    const { trackingId } = req.query;

    if (!trackingId) {
      return next(new AppError('Tracking ID is required', 400));
    }

    const tracking = await Tracking.findOne({ trackingId });

    if (!tracking) {
      return next(new AppError('Tracking information not found', 404));
    }

    res.status(200).json({
      success: true,
      data: {
        status: tracking.status,
        location: tracking.location,
        estimatedDelivery: tracking.estimatedDelivery,
        history: tracking.history
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Admin endpoints
export const updateTrackingStatus = async (req, res, next) => {
  try {
    const { trackingId } = req.params;
    const { status, location } = req.body;

    const tracking = await Tracking.findOne({ trackingId });

    if (!tracking) {
      return next(new AppError('Tracking not found', 404));
    }

    // Add to history
    tracking.history.push({
      status: tracking.status,
      location: tracking.location,
      timestamp: new Date()
    });

    // Update current status
    tracking.status = status;
    tracking.location = location;
    await tracking.save();

    // Send notification email to customer
    await sendEmail({
      to: tracking.customerEmail,
      subject: 'Shipment Status Update - RocketryBox',
      text: `Your shipment (${trackingId}) status has been updated to: ${status}\nCurrent Location: ${location}`
    });

    res.status(200).json({
      success: true,
      data: tracking
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

export const getAllTracking = async (req, res, next) => {
  try {
    const tracking = await Tracking.find().sort({ updatedAt: -1 });
    
    res.status(200).json({
      success: true,
      count: tracking.length,
      data: tracking
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
}; 
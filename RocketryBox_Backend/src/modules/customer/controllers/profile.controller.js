import fs from 'fs';
import path from 'path';
import { AppError } from '../../../middleware/errorHandler.js';
import { deleteFromS3, generateSignedUrl, uploadToS3 } from '../../../utils/fileUpload.js';
import Customer from '../models/customer.model.js';

// Get customer profile
export const getProfile = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.user.id);

    if (!customer) {
      return next(new AppError('Customer not found', 404));
    }

    // Convert customer to object to modify profileImage
    const customerData = customer.toObject();

    // Generate signed URL for profile image if it exists
    if (customerData.profileImage) {
      customerData.profileImage = await generateSignedUrl(customerData.profileImage);
    }

    res.status(200).json({
      success: true,
      data: customerData
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Update customer profile
export const updateProfile = async (req, res, next) => {
  try {
    const { name, fullName, email, phone, preferences } = req.body;

    const customer = await Customer.findById(req.user.id);

    if (!customer) {
      return next(new AppError('Customer not found', 404));
    }

    // Update fields if provided
    // Handle both 'name' and 'fullName' for backwards compatibility
    if (name || fullName) customer.name = name || fullName;
    if (email) customer.email = email;
    if (phone) customer.phone = phone;
    if (preferences) {
      if (preferences.language) customer.preferences.language = preferences.language;
      if (preferences.currency) customer.preferences.currency = preferences.currency;
      if (preferences.notifications) {
        if (preferences.notifications.email !== undefined) {
          customer.preferences.notifications.email = preferences.notifications.email;
        }
        if (preferences.notifications.sms !== undefined) {
          customer.preferences.notifications.sms = preferences.notifications.sms;
        }
        if (preferences.notifications.push !== undefined) {
          customer.preferences.notifications.push = preferences.notifications.push;
        }
      }
    }

    await customer.save();

    // Convert customer to object and generate signed URL for profile image
    const customerData = customer.toObject();
    if (customerData.profileImage) {
      customerData.profileImage = await generateSignedUrl(customerData.profileImage);
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'Profile updated successfully',
        profile: customerData
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Upload profile image to S3
export const uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No image file provided', 400));
    }

    const customer = await Customer.findById(req.user.id);

    if (!customer) {
      return next(new AppError('Customer not found', 404));
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return next(new AppError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.', 400));
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      return next(new AppError('File size too large. Maximum size is 5MB.', 400));
    }

    try {
      // Delete old profile image from S3 if it exists
      if (customer.profileImage) {
        await deleteFromS3(customer.profileImage);
      }

      // Upload new image to S3
      const s3Key = `customers/profile-images/customer-${customer._id}-${Date.now()}${path.extname(req.file.originalname)}`;
      const imageUrl = await uploadToS3(req.file, s3Key);

      // Update customer with new profile image URL
      customer.profileImage = imageUrl;
      await customer.save();

      // Generate signed URL for immediate use in response
      const signedImageUrl = await generateSignedUrl(imageUrl);

      res.status(200).json({
        success: true,
        data: {
          message: 'Profile image uploaded successfully',
          imageUrl: signedImageUrl,
          customer: customer
        }
      });

    } catch (uploadError) {
      console.error('S3 upload error:', uploadError);
      return next(new AppError('Failed to upload image to cloud storage', 500));
    }

  } catch (error) {
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(new AppError(error.message, 400));
  }
};

// Add new address
export const addAddress = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      address1,
      address2,
      city,
      state,
      pincode,
      country,
      isDefault
    } = req.body;

    const customer = await Customer.findById(req.user.id);

    if (!customer) {
      return next(new AppError('Customer not found', 404));
    }

    // If this is the first address or isDefault is true, set it as default
    if (isDefault || customer.addresses.length === 0) {
      // Set all other addresses to non-default
      customer.addresses.forEach(addr => addr.isDefault = false);
    }

    // Add new address - map 'phone' to 'mobile' for the model
    customer.addresses.push({
      name,
      mobile: phone, // Map phone to mobile for the model
      address1,
      address2,
      city,
      state,
      pincode,
      country: country || 'India',
      isDefault: isDefault || customer.addresses.length === 0
    });

    await customer.save();

    res.status(201).json({
      success: true,
      data: {
        message: 'Address added successfully',
        addresses: customer.addresses
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Update address
export const updateAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      address1,
      address2,
      city,
      state,
      pincode,
      country,
      isDefault
    } = req.body;

    const customer = await Customer.findById(req.user.id);

    if (!customer) {
      return next(new AppError('Customer not found', 404));
    }

    // Find address
    const address = customer.addresses.id(id);

    if (!address) {
      return next(new AppError('Address not found', 404));
    }

    // Update address fields
    if (name) address.name = name;
    if (phone) address.mobile = phone;
    if (address1) address.address1 = address1;
    if (address2 !== undefined) address.address2 = address2;
    if (city) address.city = city;
    if (state) address.state = state;
    if (pincode) address.pincode = pincode;
    if (country) address.country = country;

    // Handle default address
    if (isDefault) {
      customer.addresses.forEach(addr => {
        addr.isDefault = addr._id.toString() === id;
      });
    }

    await customer.save();

    res.status(200).json({
      success: true,
      data: {
        message: 'Address updated successfully',
        addresses: customer.addresses
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Delete address
export const deleteAddress = async (req, res, next) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(req.user.id);

    if (!customer) {
      return next(new AppError('Customer not found', 404));
    }

    // Find address
    const address = customer.addresses.id(id);

    if (!address) {
      return next(new AppError('Address not found', 404));
    }

    // Remove address
    customer.addresses.pull(id);

    // If deleted address was default and there are other addresses,
    // set the first remaining address as default
    if (address.isDefault && customer.addresses.length > 0) {
      customer.addresses[0].isDefault = true;
    }

    await customer.save();

    res.status(200).json({
      success: true,
      data: {
        message: 'Address deleted successfully',
        addresses: customer.addresses
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Get profile image signed URL
export const getProfileImageUrl = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.user.id);

    if (!customer) {
      return next(new AppError('Customer not found', 404));
    }

    if (!customer.profileImage) {
      return next(new AppError('No profile image found', 404));
    }

    // Generate fresh signed URL
    const signedUrl = await generateSignedUrl(customer.profileImage);

    res.status(200).json({
      success: true,
      data: {
        imageUrl: signedUrl
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Admin from '../modules/admin/models/admin.model.js';
import { logger } from '../utils/logger.js';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_ATLAS_URI || 'mongodb://localhost:27017/rocketrybox';

const checkAdmin = async () => {
  try {
    // Connect to MongoDB with explicit database name
    await mongoose.connect(MONGODB_URI, {
      dbName: 'RocketryBox'  // Force connection to RocketryBox database
    });
    logger.info('Connected to MongoDB database: RocketryBox');

    // Find the admin
    const admin = await Admin.findOne({ email: 'superadmin@rocketrybox.com' }).select('+password');

    if (!admin) {
      logger.error('Admin not found!');
      return;
    }

    logger.info('Admin found:', {
      id: admin._id,
      email: admin.email,
      role: admin.role,
      status: admin.status,
      hasPassword: !!admin.password
    });

    // Test password
    const testPassword = 'SuperAdmin@123';
    const isPasswordCorrect = await admin.isPasswordCorrect(testPassword);
    logger.info('Password test result:', { isPasswordCorrect });

  } catch (error) {
    logger.error('Error checking admin:', error);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
};

checkAdmin();

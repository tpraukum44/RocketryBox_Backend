import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Admin from '../modules/admin/models/admin.model.js';
import { logger } from '../utils/logger.js';

// Load environment variables
dotenv.config();

if (!process.env.MONGODB_URI && !process.env.MONGODB_ATLAS_URI) {
  logger.error('MongoDB connection string not found in environment variables. Please set MONGODB_URI or MONGODB_ATLAS_URI');
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI;

const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB with explicit database name
    logger.info('Attempting to connect to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      dbName: 'RocketryBox'  // Force connection to RocketryBox database
    });
    logger.info('Connected to MongoDB database: RocketryBox');

    // Check if super admin already exists
    const existingAdmin = await Admin.findOne({ email: 'superadmin@rocketrybox.com' });
    if (existingAdmin) {
      logger.info('Super admin already exists');
      process.exit(0);
    }

    // Create super admin
    const superAdmin = await Admin.create({
      fullName: 'Super Admin',
      email: 'superadmin@rocketrybox.com',
      phoneNumber: '1234567890',
      password: 'SuperAdmin@123', // You should change this immediately after creation
      role: 'Admin',
      department: 'Technology',
      designation: 'System Administrator',
      isSuperAdmin: true,
      status: 'Active',
      dateOfJoining: new Date(),
      remarks: 'Initial super admin account'
    });

    logger.info('Super admin created successfully:', {
      id: superAdmin._id,
      email: superAdmin.email,
      role: superAdmin.role
    });

  } catch (error) {
    logger.error('Error creating super admin:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
};

// Run the script
createSuperAdmin();

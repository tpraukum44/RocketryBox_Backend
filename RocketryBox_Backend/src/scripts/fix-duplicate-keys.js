import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// MongoDB connection URI
const MONGODB_URI = process.env.MONGODB_ATLAS_URI || process.env.MONGODB_URI;
if (!MONGODB_URI) {
  logger.error('MongoDB URI not found in environment variables. Please check your .env file.');
  process.exit(1);
}

async function fixDuplicateKeys() {
  try {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      dbName: 'RocketryBox'  // Force connection to RocketryBox database
    });
    logger.info('Connected to MongoDB database: RocketryBox');

    // Get the customers collection
    const db = mongoose.connection;
    const customersCollection = db.collection('customers');

    // Find documents with null phone/mobile
    const nullPhoneCustomers = await customersCollection.find({
      $or: [
        { mobile: null },
        { mobile: "" },
        { mobile: { $exists: false } },
        { phone: null },
        { phone: "" },
        { phone: { $exists: false } }
      ]
    }).toArray();

    logger.info(`Found ${nullPhoneCustomers.length} customers with null or empty mobile/phone numbers`);

    // Update null or empty phone numbers to a temporary unique value
    let updateCount = 0;
    for (const customer of nullPhoneCustomers) {
      const tempValue = `temp-${customer._id}-${Date.now()}`;
      const updateFields = {};

      if (!customer.mobile || customer.mobile === '') {
        updateFields.mobile = tempValue + '-mobile';
      }

      if (!customer.phone || customer.phone === '') {
        updateFields.phone = tempValue + '-phone';
      }

      if (Object.keys(updateFields).length > 0) {
        await customersCollection.updateOne(
          { _id: customer._id },
          { $set: updateFields }
        );
        updateCount++;
      }
    }

    logger.info(`Updated ${updateCount} customers with temporary values`);

    // Get all index information
    const indexInfo = await customersCollection.indexInformation();
    logger.info('Current indices:', indexInfo);

    // Drop problematic indices
    const indicesToDrop = ['mobile_1', 'phone_1'];

    for (const indexName of indicesToDrop) {
      try {
        if (indexInfo[indexName]) {
          logger.info(`Dropping index ${indexName}...`);
          await customersCollection.dropIndex(indexName);
          logger.info(`Successfully dropped ${indexName} index`);
        } else {
          logger.info(`Index ${indexName} does not exist, skipping`);
        }
      } catch (indexError) {
        logger.warn(`Error dropping index ${indexName}:`, indexError.message);
      }
    }

    // Create sparse indices
    await customersCollection.createIndex(
      { mobile: 1 },
      { unique: true, sparse: true, background: true, name: "mobile_sparse_1" }
    );
    logger.info('Successfully created sparse index for mobile field');

    try {
      await customersCollection.createIndex(
        { phone: 1 },
        { unique: true, sparse: true, background: true, name: "phone_sparse_1" }
      );
      logger.info('Successfully created sparse index for phone field');
    } catch (phoneIndexError) {
      logger.warn('Error creating phone index, it may not be needed:', phoneIndexError.message);
    }

    logger.info('Database fix completed successfully');
  } catch (error) {
    logger.error('Error fixing duplicate keys:', error);
  } finally {
    // Close the MongoDB connection
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  }
}

// Run the fix function
fixDuplicateKeys();

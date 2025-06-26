import dotenv from 'dotenv';
import mongoose from 'mongoose';
import ShippingPartner from '../modules/admin/models/shippingPartner.model.js';

// Load environment variables
dotenv.config();

const checkPartners = async () => {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_ATLAS_URI || 'mongodb://localhost:27017/rocketrybox';
    await mongoose.connect(MONGODB_URI, {
      dbName: 'RocketryBox'  // Force connection to RocketryBox database
    });
    console.log('Connected to MongoDB database: RocketryBox');

    // Check for shipping partners
    const partners = await ShippingPartner.find({});
    console.log(`Found ${partners.length} shipping partners:`);

    if (partners.length > 0) {
      partners.forEach((partner, index) => {
        console.log(`${index + 1}. ${partner.name} (${partner.apiStatus}) - ID: ${partner._id}`);
      });
    } else {
      console.log('No shipping partners found in the database.');
    }

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error checking partners:', error);
    process.exit(1);
  }
};

// Run the script
checkPartners();

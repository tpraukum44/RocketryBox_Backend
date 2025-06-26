import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Pincode from '../models/pincode.model.js';

dotenv.config();

// Connect to MongoDB - Using a default connection if env not available
const MONGODB_URI = process.env.MONGODB_ATLAS_URI || 'mongodb://localhost:27017/rocketrybox';

console.log('Attempting to connect to MongoDB...');
console.log(`Connection URI: ${MONGODB_URI}`);

// Sample pincodes data for major Indian cities
const samplePincodes = [
  {
    pincode: "110001",
    officeName: "Connaught Place",
    district: "Central Delhi",
    state: "Delhi",
    region: "Delhi",
    circle: "Delhi",
    taluk: "New Delhi"
  },
  {
    pincode: "400001",
    officeName: "GPO",
    district: "Mumbai",
    state: "Maharashtra",
    region: "Mumbai",
    circle: "Maharashtra",
    taluk: "Mumbai"
  },
  {
    pincode: "700001",
    officeName: "GPO Kolkata",
    district: "Kolkata",
    state: "West Bengal",
    region: "Kolkata",
    circle: "West Bengal",
    taluk: "Kolkata"
  },
  {
    pincode: "600001",
    officeName: "GPO Chennai",
    district: "Chennai",
    state: "Tamil Nadu",
    region: "Chennai",
    circle: "Tamil Nadu",
    taluk: "Chennai"
  },
  {
    pincode: "500001",
    officeName: "GPO Hyderabad",
    district: "Hyderabad",
    state: "Telangana",
    region: "Hyderabad",
    circle: "Andhra Pradesh",
    taluk: "Hyderabad"
  },
  {
    pincode: "560001",
    officeName: "GPO Bangalore",
    district: "Bangalore",
    state: "Karnataka",
    region: "Karnataka",
    circle: "Karnataka",
    taluk: "Bangalore"
  },
  {
    pincode: "380001",
    officeName: "GPO Ahmedabad",
    district: "Ahmedabad",
    state: "Gujarat",
    region: "Gujarat",
    circle: "Gujarat",
    taluk: "Ahmedabad"
  },
  {
    pincode: "641001",
    officeName: "GPO Coimbatore",
    district: "Coimbatore",
    state: "Tamil Nadu",
    region: "Chennai",
    circle: "Tamil Nadu",
    taluk: "Coimbatore"
  },
  {
    pincode: "800001",
    officeName: "GPO Patna",
    district: "Patna",
    state: "Bihar",
    region: "Bihar",
    circle: "Bihar",
    taluk: "Patna"
  },
  {
    pincode: "452001",
    officeName: "GPO Indore",
    district: "Indore",
    state: "Madhya Pradesh",
    region: "Madhya Pradesh",
    circle: "Madhya Pradesh",
    taluk: "Indore"
  }
];

async function createSamplePincodes() {
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: 'RocketryBox'  // Force connection to RocketryBox database
    });
    console.log('Connected to MongoDB database: RocketryBox');

    // Check if we already have sample data
    const existingCount = await Pincode.countDocuments();
    if (existingCount > 0) {
      console.log(`Found ${existingCount} existing pincode records.`);
      const proceed = process.argv.includes('--force');
      if (!proceed) {
        console.log('Database already has pincode data. To reimport, use --force flag.');
        await mongoose.connection.close();
        return;
      } else {
        console.log('Force import requested. Clearing existing data...');
        await Pincode.deleteMany({});
      }
    }

    // Insert sample data
    console.log('Inserting sample pincode data...');
    await Pincode.insertMany(samplePincodes);

    console.log(`Successfully inserted ${samplePincodes.length} sample pincodes.`);

    // Create index if it doesn't exist
    console.log('Creating index on pincode field...');
    await Pincode.collection.createIndex({ pincode: 1 });
    console.log('Index created successfully.');

    await mongoose.connection.close();
    console.log('Database connection closed.');

  } catch (error) {
    console.error('Error creating sample pincodes:', error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

// Run the function
createSamplePincodes()
  .then(() => {
    console.log('Sample data creation completed successfully.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Process failed:', err.message);
    process.exit(1);
  });

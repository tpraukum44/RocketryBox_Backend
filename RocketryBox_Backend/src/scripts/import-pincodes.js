import axios from 'axios';
import csv from 'csv-parser';
import dotenv from 'dotenv';
import fs from 'fs';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import Pincode from '../models/pincode.model.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// URL for the pincode data CSV
const PINCODE_DATA_URL = 'https://raw.githubusercontent.com/avinashcelestine/Pincodes-data/master/postofficeswithpins.csv';
const CSV_PATH = path.join(__dirname, '../../temp/pincodes.csv');

// Connect to MongoDB - Using a default connection if env not available
const MONGODB_URI = process.env.MONGODB_ATLAS_URI || 'mongodb://localhost:27017/rocketrybox';

console.log('Attempting to connect to MongoDB...');
console.log(`Connection URI: ${MONGODB_URI}`);

mongoose.connect(MONGODB_URI, {
  dbName: 'RocketryBox'  // Force connection to RocketryBox database
})
  .then(() => console.log('Connected to MongoDB database: RocketryBox'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Ensure temp directory exists
const tempDir = path.join(__dirname, '../../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Download the CSV file
async function downloadCSV() {
  try {
    console.log('Downloading pincode data...');
    const response = await axios({
      method: 'GET',
      url: PINCODE_DATA_URL,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(CSV_PATH);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('Download completed successfully!');
        resolve();
      });
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('Error downloading pincode data:', error.message);
    throw error;
  }
}

// Parse and import CSV into MongoDB
async function importPincodes() {
  try {
    // Count existing records
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

    // Download CSV if it doesn't exist
    if (!fs.existsSync(CSV_PATH)) {
      await downloadCSV();
    } else if (process.argv.includes('--force-download')) {
      await downloadCSV();
    }

    console.log('Importing pincodes into database...');
    const pincodes = [];
    let count = 0;
    let batchNum = 1;

    // Parse the CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_PATH)
        .pipe(csv())
        .on('data', async (data) => {
          // Map CSV columns to model fields
          // Note: CSV fields have various capitalizations, handle all variations
          const pincode = {
            pincode: data.pincode,
            officeName: data.officename,
            district: data.Districtname || data.districtname || '',
            state: data.statename,
            region: data.regionname,
            circle: data.circlename,
            taluk: data.Taluk || data.taluk || ''
          };

          // Add to batch if pincode exists
          if (pincode.pincode) {
            pincodes.push(pincode);
            count++;

            // Insert in batches of 1000 for better performance
            if (pincodes.length >= 1000) {
              try {
                await Pincode.insertMany(pincodes);
                console.log(`Inserted batch #${batchNum}, processed ${count} pincodes`);
                batchNum++;
                pincodes.length = 0; // Clear the array
              } catch (err) {
                console.error('Error inserting batch:', err);
              }
            }
          }
        })
        .on('end', async () => {
          // Insert any remaining records
          if (pincodes.length > 0) {
            try {
              await Pincode.insertMany(pincodes);
              console.log(`Inserted final batch #${batchNum}, total ${count} pincodes`);
            } catch (err) {
              console.error('Error inserting final batch:', err);
            }
          }
          console.log(`Import completed! ${count} pincodes imported.`);
          resolve();
        })
        .on('error', (error) => {
          console.error('Error parsing CSV:', error);
          reject(error);
        });
    });

    // Create index on pincode field for faster lookups
    console.log('Creating index on pincode field...');
    await Pincode.collection.createIndex({ pincode: 1 });
    console.log('Index created successfully');

    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed');

  } catch (error) {
    console.error('Error importing pincodes:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the import function
importPincodes()
  .then(() => {
    console.log('Import process completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Import process failed:', err);
    process.exit(1);
  });

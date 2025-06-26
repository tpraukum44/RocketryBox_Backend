import dotenv from 'dotenv';
import fs from 'fs';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import RateCard from '../models/ratecard.model.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the rate card JSON file
const RATECARD_JSON_PATH = path.join(__dirname, '../data/ratecard.json');

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

// Import rate cards from JSON into MongoDB
async function importRateCards() {
  try {
    // Count existing records
    const existingCount = await RateCard.countDocuments();
    if (existingCount > 0) {
      console.log(`Found ${existingCount} existing rate card records.`);
      const proceed = process.argv.includes('--force');
      if (!proceed) {
        console.log('Database already has rate card data. To reimport, use --force flag.');
        await mongoose.connection.close();
        return;
      } else {
        console.log('Force import requested. Clearing existing data...');
        await RateCard.deleteMany({});
      }
    }

    // Check if JSON file exists
    if (!fs.existsSync(RATECARD_JSON_PATH)) {
      console.error(`Rate card JSON file not found at: ${RATECARD_JSON_PATH}`);
      console.error('Please ensure the ratecard.json file exists in the data directory.');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log('Reading rate card data from JSON file...');
    const jsonData = fs.readFileSync(RATECARD_JSON_PATH, 'utf8');
    const rateCardsData = JSON.parse(jsonData);

    if (!Array.isArray(rateCardsData)) {
      console.error('Invalid JSON format: Expected an array of rate card objects.');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`Found ${rateCardsData.length} rate card entries to import...`);

    // Validate and process the data
    const processedRateCards = [];
    let invalidCount = 0;

    for (let i = 0; i < rateCardsData.length; i++) {
      const item = rateCardsData[i];

      try {
        // Convert codAmount from string to number if it's a string
        const processedItem = {
          courier: item.courier,
          productName: item.productName,
          mode: item.mode,
          zone: item.zone,
          baseRate: Number(item.baseRate),
          addlRate: Number(item.addlRate),
          codAmount: Number(item.codAmount) || 0,
          codPercent: Number(item.codPercent) || 0,
          rtoCharges: Number(item.rtoCharges) || 0,
          minimumBillableWeight: Number(item.minimumBillableWeight) || 0.5,
          isActive: true
        };

        // Basic validation
        if (!processedItem.courier || !processedItem.productName || !processedItem.zone) {
          console.warn(`Skipping invalid entry at index ${i}: Missing required fields`);
          invalidCount++;
          continue;
        }

        processedRateCards.push(processedItem);
      } catch (error) {
        console.warn(`Skipping invalid entry at index ${i}: ${error.message}`);
        invalidCount++;
      }
    }

    if (processedRateCards.length === 0) {
      console.error('No valid rate card entries found to import.');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`Processing ${processedRateCards.length} valid entries (${invalidCount} invalid entries skipped)...`);

    // Insert in batches for better performance
    const batchSize = 50;
    let insertedCount = 0;

    for (let i = 0; i < processedRateCards.length; i += batchSize) {
      const batch = processedRateCards.slice(i, i + batchSize);

      try {
        await RateCard.insertMany(batch);
        insertedCount += batch.length;
        console.log(`Inserted batch: ${insertedCount}/${processedRateCards.length} rate cards`);
      } catch (error) {
        console.error(`Error inserting batch starting at index ${i}:`, error.message);

        // Try inserting individual records in case of batch failure
        for (const record of batch) {
          try {
            await RateCard.create(record);
            insertedCount++;
            console.log(`Individual insert successful: ${insertedCount}/${processedRateCards.length}`);
          } catch (individualError) {
            console.error(`Failed to insert individual record for ${record.courier} - ${record.productName}:`, individualError.message);
          }
        }
      }
    }

    console.log(`\nImport Summary:`);
    console.log(`- Total entries in JSON: ${rateCardsData.length}`);
    console.log(`- Valid entries processed: ${processedRateCards.length}`);
    console.log(`- Successfully inserted: ${insertedCount}`);
    console.log(`- Invalid entries skipped: ${invalidCount}`);
    console.log(`- Failed to insert: ${processedRateCards.length - insertedCount}`);

    // Create indexes for better performance
    console.log('\nCreating database indexes...');
    try {
      await RateCard.collection.createIndex({ courier: 1, zone: 1, mode: 1 });
      await RateCard.collection.createIndex({ zone: 1, isActive: 1 });
      await RateCard.collection.createIndex({ courier: 1, isActive: 1 });
      console.log('Indexes created successfully');
    } catch (indexError) {
      console.warn('Warning: Could not create indexes:', indexError.message);
    }

    // Display some statistics
    console.log('\nData Statistics:');
    const courierStats = await RateCard.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$courier', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('Rate cards per courier:');
    courierStats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} rate cards`);
    });

    const zoneStats = await RateCard.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$zone', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\nRate cards per zone:');
    zoneStats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} rate cards`);
    });

    // Close the database connection
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');

  } catch (error) {
    console.error('Error importing rate cards:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the import function
console.log('Starting Rate Card Import Process...');
console.log('='.repeat(50));

importRateCards()
  .then(() => {
    console.log('\n' + '='.repeat(50));
    console.log('Rate Card import process completed successfully!');
    console.log('You can now use the rate cards in your application.');
    console.log('\nUsage examples:');
    console.log('- Find all Bluedart rates: RateCard.find({ courier: "Bluedart", isActive: true })');
    console.log('- Find rates for a zone: RateCard.findByZoneAndCourier("Within City")');
    console.log('- Get all active couriers: RateCard.getActiveCouriers()');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n' + '='.repeat(50));
    console.error('Rate Card import process failed:', err);
    process.exit(1);
  });

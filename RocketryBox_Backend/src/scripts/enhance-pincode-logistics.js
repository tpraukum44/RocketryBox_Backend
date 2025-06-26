import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Pincode from '../models/pincode.model.js';

dotenv.config();

console.log('🚀 Starting Pincode Logistics Enhancement...');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_ATLAS_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_ATLAS_URI not found in environment variables');
  process.exit(1);
}

await mongoose.connect(MONGODB_URI, { dbName: 'RocketryBox' });
console.log('✅ Connected to MongoDB');

// Metro city pincode ranges (first 3 digits)
const metroCityRanges = {
  // Delhi
  '110': { city: 'Delhi', zone: 'Metro' },
  '121': { city: 'Delhi NCR', zone: 'Metro' },
  '122': { city: 'Delhi NCR', zone: 'Metro' },

  // Mumbai
  '400': { city: 'Mumbai', zone: 'Metro' },
  '401': { city: 'Mumbai', zone: 'Metro' },

  // Bangalore
  '560': { city: 'Bangalore', zone: 'Metro' },
  '561': { city: 'Bangalore', zone: 'Metro' },

  // Chennai
  '600': { city: 'Chennai', zone: 'Metro' },
  '601': { city: 'Chennai', zone: 'Metro' },
  '602': { city: 'Chennai', zone: 'Metro' },
  '603': { city: 'Chennai', zone: 'Metro' },

  // Kolkata
  '700': { city: 'Kolkata', zone: 'Metro' },
  '701': { city: 'Kolkata', zone: 'Metro' },

  // Hyderabad
  '500': { city: 'Hyderabad', zone: 'Metro' },
  '501': { city: 'Hyderabad', zone: 'Metro' },

  // Pune
  '411': { city: 'Pune', zone: 'Metro' },
  '412': { city: 'Pune', zone: 'Metro' },

  // Ahmedabad
  '380': { city: 'Ahmedabad', zone: 'Metro' },
  '382': { city: 'Ahmedabad', zone: 'Metro' },

  // Jaipur
  '302': { city: 'Jaipur', zone: 'Metro' },
  '303': { city: 'Jaipur', zone: 'Metro' },

  // Surat
  '395': { city: 'Surat', zone: 'Metro' },

  // Chandigarh
  '160': { city: 'Chandigarh', zone: 'Metro' },

  // Kochi
  '682': { city: 'Kochi', zone: 'Metro' }
};

// North East states (special handling)
const northEastStates = [
  'Arunachal Pradesh', 'Assam', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Tripura', 'Sikkim'
];

// Default courier partners
const defaultCourierPartners = [
  {
    name: 'Delhivery',
    serviceTypes: ['standard', 'express', 'cod'],
    isActive: true
  },
  {
    name: 'Ekart Logistics',
    serviceTypes: ['standard', 'express', 'cod'],
    isActive: true
  },
  {
    name: 'BlueDart',
    serviceTypes: ['express'],
    isActive: true
  },
  {
    name: 'XpressBees',
    serviceTypes: ['standard', 'express'],
    isActive: true
  },
  {
    name: 'Ecom Express',
    serviceTypes: ['standard', 'express', 'cod'],
    isActive: true
  }
];

function determineZone(pincode, state, district) {
  const prefix = pincode.substring(0, 3);

  // Check if it's a metro city
  if (metroCityRanges[prefix]) {
    return {
      zone: 'Metro',
      isMetro: true,
      deliveryTimeEstimate: {
        standard: '2-3 days',
        express: '1-2 days'
      }
    };
  }

  // Check for North East states
  if (northEastStates.includes(state)) {
    return {
      zone: 'North East',
      isMetro: false,
      deliveryTimeEstimate: {
        standard: '5-7 days',
        express: '3-5 days'
      }
    };
  }

  // Check for within city (same first 3 digits as metro)
  for (const [metroPrefix, metroInfo] of Object.entries(metroCityRanges)) {
    if (prefix === metroPrefix) {
      return {
        zone: 'Within City',
        isMetro: false,
        deliveryTimeEstimate: {
          standard: '1-2 days',
          express: '24 hours'
        }
      };
    }
  }

  // Default to Rest of India
  return {
    zone: 'Rest of India',
    isMetro: false,
    deliveryTimeEstimate: {
      standard: '3-5 days',
      express: '2-3 days'
    }
  };
}

async function enhancePincodeLogistics() {
  try {
    console.log('\n📊 Checking existing pincode records...');

    const totalPincodes = await Pincode.countDocuments();
    console.log(`Total pincodes: ${totalPincodes.toLocaleString()}`);

    if (totalPincodes === 0) {
      console.log('❌ No pincode records found. Please run import-pincodes.js first.');
      return;
    }

    console.log('\n🔧 Enhancing pincode records with logistics data...');

    let processed = 0;
    let updated = 0;
    const batchSize = 1000;

    // Process in batches
    for (let skip = 0; skip < totalPincodes; skip += batchSize) {
      const pincodes = await Pincode.find({})
        .skip(skip)
        .limit(batchSize)
        .lean();

      const bulkOps = [];

      for (const pincode of pincodes) {
        // Skip if logistics data already exists
        if (pincode.logistics && pincode.logistics.zone) {
          processed++;
          continue;
        }

        const logisticsData = determineZone(
          pincode.pincode,
          pincode.state,
          pincode.district
        );

        bulkOps.push({
          updateOne: {
            filter: { _id: pincode._id },
            update: {
              $set: {
                'logistics.zone': logisticsData.zone,
                'logistics.isMetro': logisticsData.isMetro,
                'logistics.isServiceable': true,
                'logistics.courierPartners': defaultCourierPartners,
                'logistics.deliveryTimeEstimate': logisticsData.deliveryTimeEstimate,
                'logistics.restrictions': [],
                'logistics.lastUpdated': new Date()
              }
            }
          }
        });

        updated++;
        processed++;
      }

      // Execute batch updates
      if (bulkOps.length > 0) {
        await Pincode.bulkWrite(bulkOps);
      }

      console.log(`Processed: ${processed.toLocaleString()} / ${totalPincodes.toLocaleString()} (${Math.round(processed / totalPincodes * 100)}%)`);
    }

    console.log(`\n✅ Enhancement completed!`);
    console.log(`📊 Statistics:`);
    console.log(`  - Total processed: ${processed.toLocaleString()}`);
    console.log(`  - Records updated: ${updated.toLocaleString()}`);
    console.log(`  - Records skipped: ${(processed - updated).toLocaleString()}`);

    // Show zone distribution
    console.log('\n📈 Zone Distribution:');
    const zoneStats = await Pincode.aggregate([
      { $group: { _id: '$logistics.zone', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    zoneStats.forEach(stat => {
      console.log(`  - ${stat._id || 'Unassigned'}: ${stat.count.toLocaleString()}`);
    });

    // Show metro distribution
    console.log('\n🏙️ Metro vs Non-Metro:');
    const metroStats = await Pincode.aggregate([
      { $group: { _id: '$logistics.isMetro', count: { $sum: 1 } } }
    ]);

    metroStats.forEach(stat => {
      const label = stat._id ? 'Metro Cities' : 'Non-Metro';
      console.log(`  - ${label}: ${stat.count.toLocaleString()}`);
    });

  } catch (error) {
    console.error('❌ Error enhancing pincodes:', error);
  }
}

// Run the enhancement
await enhancePincodeLogistics();

// Close connection
await mongoose.connection.close();
console.log('\n🔌 Database connection closed');
process.exit(0);

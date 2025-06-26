import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Seller from '../modules/seller/models/seller.model.js';

// Load environment variables
dotenv.config();

const checkAllSellers = async () => {
  try {
    console.log('🔍 CHECKING ALL SELLERS IN DATABASE');
    console.log('='.repeat(40));

    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_ATLAS_URI || 'mongodb://localhost:27017/rocketrybox';
    await mongoose.connect(MONGODB_URI, {
      dbName: 'RocketryBox'
    });
    console.log('✅ Connected to MongoDB database: RocketryBox');

    // Find all sellers
    const sellers = await Seller.find({}).select('name email phone businessName monthlyShipments status createdAt');

    if (sellers.length === 0) {
      console.log('❌ No sellers found in database!');
      return;
    }

    console.log(`\n👥 FOUND ${sellers.length} SELLER(S):`);
    console.log('='.repeat(30));

    sellers.forEach((seller, index) => {
      console.log(`\n${index + 1}. 👤 ${seller.name || 'No name'}`);
      console.log(`   📧 Email: ${seller.email}`);
      console.log(`   📱 Phone: ${seller.phone || 'No phone'}`);
      console.log(`   🏢 Business: ${seller.businessName || 'No business name'}`);
      console.log(`   📦 Monthly Shipments: ${seller.monthlyShipments || 'Not set'}`);
      console.log(`   📊 Status: ${seller.status || 'No status'}`);
      console.log(`   📅 Created: ${seller.createdAt ? seller.createdAt.toISOString().split('T')[0] : 'No date'}`);
    });

    console.log('\n📊 MONTHLY SHIPMENTS ANALYSIS:');
    console.log('='.repeat(35));

    const withMonthlyShipments = sellers.filter(s => s.monthlyShipments);
    const withoutMonthlyShipments = sellers.filter(s => !s.monthlyShipments);

    console.log(`✅ Sellers WITH monthly shipments: ${withMonthlyShipments.length}`);
    console.log(`❌ Sellers WITHOUT monthly shipments: ${withoutMonthlyShipments.length}`);

    if (withMonthlyShipments.length > 0) {
      console.log('\n📦 MONTHLY SHIPMENTS VALUES:');
      withMonthlyShipments.forEach(seller => {
        console.log(`   ${seller.email}: "${seller.monthlyShipments}"`);
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Check completed successfully!');

  } catch (error) {
    console.error('❌ Error during check:', error.message);
  }
};

console.log('🔍 Checking All Sellers...');
checkAllSellers();

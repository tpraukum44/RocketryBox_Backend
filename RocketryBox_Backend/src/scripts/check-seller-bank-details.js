import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Seller from '../modules/seller/models/seller.model.js';

// Load environment variables
dotenv.config();

const checkSellerBankDetails = async () => {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_ATLAS_URI || 'mongodb://localhost:27017/rocketrybox';
    await mongoose.connect(MONGODB_URI, {
      dbName: 'RocketryBox'
    });
    console.log('✅ Connected to MongoDB database: RocketryBox');

    // Find all sellers and check their bank details
    const sellers = await Seller.find({}).select('name email phone businessName bankDetails status createdAt');

    if (sellers.length === 0) {
      console.log('❌ No sellers found in database!');
      return;
    }

    console.log(`\n🔍 ANALYZING ${sellers.length} SELLER(S) BANK DETAILS`);
    console.log('='.repeat(60));

    let sellersWithBankDetails = 0;
    let sellersWithoutBankDetails = 0;

    sellers.forEach((seller, index) => {
      console.log(`\n${index + 1}️⃣ SELLER: ${seller.name}`);
      console.log('─'.repeat(40));
      console.log('📧 Email:', seller.email);
      console.log('📞 Phone:', seller.phone);
      console.log('🏢 Business:', seller.businessName);
      console.log('✅ Status:', seller.status);
      console.log('📅 Created:', seller.createdAt?.toISOString().split('T')[0]);

      if (seller.bankDetails && Object.keys(seller.bankDetails).length > 0) {
        sellersWithBankDetails++;
        console.log('🏦 BANK DETAILS: ✅ PRESENT');
        console.log('   └─ Bank Name:', seller.bankDetails.bankName || 'Not set');
        console.log('   └─ Account Holder:', seller.bankDetails.accountHolderName || 'Not set');
        console.log('   └─ Account Number:', seller.bankDetails.accountNumber ? `***${seller.bankDetails.accountNumber.slice(-4)}` : 'Not set');
        console.log('   └─ IFSC Code:', seller.bankDetails.ifscCode || 'Not set');
        console.log('   └─ Account Type:', seller.bankDetails.accountType || 'Not set');
        console.log('   └─ Cancelled Cheque:', seller.bankDetails.cancelledCheque?.url ? 'Uploaded' : 'Not uploaded');
        console.log('   └─ Cheque Status:', seller.bankDetails.cancelledCheque?.status || 'N/A');
      } else {
        sellersWithoutBankDetails++;
        console.log('🏦 BANK DETAILS: ❌ MISSING OR EMPTY');
        if (seller.bankDetails) {
          console.log('   └─ Bank Details Object exists but empty:', JSON.stringify(seller.bankDetails));
        } else {
          console.log('   └─ Bank Details Object is null/undefined');
        }
      }
    });

    console.log('\n📊 SUMMARY');
    console.log('='.repeat(30));
    console.log(`✅ Sellers with bank details: ${sellersWithBankDetails}`);
    console.log(`❌ Sellers without bank details: ${sellersWithoutBankDetails}`);
    console.log(`📈 Coverage: ${Math.round((sellersWithBankDetails / sellers.length) * 100)}%`);

    if (sellersWithoutBankDetails > 0) {
      console.log('\n🔧 RECOMMENDATIONS:');
      console.log('='.repeat(25));
      console.log('1. Check if sellers completed bank details during onboarding');
      console.log('2. Verify bank details update API is working correctly');
      console.log('3. Check if admin bank details update is functioning');
      console.log('4. Ensure form validation is not preventing bank details save');
    }

    // Let's also test fetching a specific seller as the admin would
    if (sellers.length > 0) {
      const firstSeller = sellers[0];
      console.log('\n🧪 TESTING ADMIN API SIMULATION');
      console.log('='.repeat(40));
      console.log(`Testing with seller: ${firstSeller.name} (${firstSeller.email})`);

      // Simulate what the admin API returns
      const adminSellerData = await Seller.findById(firstSeller._id).select({
        _id: 1,
        rbUserId: 1,
        name: 1,
        email: 1,
        phone: 1,
        businessName: 1,
        bankDetails: 1, // Ensure bank details are included
        status: 1,
        createdAt: 1,
        updatedAt: 1
      });

      console.log('📡 Admin API would return:');
      console.log('   └─ ID:', adminSellerData._id);
      console.log('   └─ Name:', adminSellerData.name);
      console.log('   └─ Email:', adminSellerData.email);
      console.log('   └─ Business:', adminSellerData.businessName);
      console.log('   └─ Bank Details Present:', !!(adminSellerData.bankDetails && Object.keys(adminSellerData.bankDetails).length > 0));

      if (adminSellerData.bankDetails && Object.keys(adminSellerData.bankDetails).length > 0) {
        console.log('   └─ Bank Details Structure:', JSON.stringify(adminSellerData.bankDetails, null, 4));
      } else {
        console.log('   └─ Bank Details Issue: Empty or missing in API response');
      }
    }

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
};

console.log('🏦 Checking Seller Bank Details...');
checkSellerBankDetails();

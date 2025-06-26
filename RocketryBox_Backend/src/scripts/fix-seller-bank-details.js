import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Seller from '../modules/seller/models/seller.model.js';

// Load environment variables
dotenv.config();

const fixSellerBankDetails = async () => {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_ATLAS_URI || 'mongodb://localhost:27017/rocketrybox';
    await mongoose.connect(MONGODB_URI, {
      dbName: 'RocketryBox'
    });
    console.log('✅ Connected to MongoDB database: RocketryBox');

    // Find the seller
    const sellerEmail = 'iamarno936@gmail.com'; // Your seller email
    const seller = await Seller.findOne({ email: sellerEmail });

    if (!seller) {
      console.log('❌ Seller not found!');
      return;
    }

    console.log('🔍 Found seller:', seller.name);
    console.log('📧 Email:', seller.email);
    console.log('🏢 Business:', seller.businessName);

    console.log('\n🏦 Current bank details:');
    console.log(JSON.stringify(seller.bankDetails, null, 2));

    // Complete bank details structure
    const completeBankDetails = {
      accountType: 'savings',
      bankName: 'State Bank of India', // Example - you can change this
      accountNumber: '1234567890123456', // Example - you can change this
      accountHolderName: seller.name, // Use seller's name
      ifscCode: 'SBIN0001234', // Example - you can change this
      cancelledCheque: seller.bankDetails?.cancelledCheque || {
        url: 'https://rocketrybox.s3.ap-south-1.amazonaws.com/sellers/documents/cheque/seller-6842f0cb2def318ed62713b5-1749218558459.pdf',
        status: 'pending'
      }
    };

    console.log('\n💰 Updating with complete bank details:');
    console.log(JSON.stringify(completeBankDetails, null, 2));

    // Update the seller's bank details
    const updatedSeller = await Seller.findByIdAndUpdate(
      seller._id,
      { bankDetails: completeBankDetails },
      { new: true, runValidators: true }
    );

    if (updatedSeller) {
      console.log('\n✅ BANK DETAILS UPDATED SUCCESSFULLY!');
      console.log('='.repeat(50));
      console.log('🏦 Updated Bank Details:');
      console.log('   └─ Account Type:', updatedSeller.bankDetails.accountType);
      console.log('   └─ Bank Name:', updatedSeller.bankDetails.bankName);
      console.log('   └─ Account Holder:', updatedSeller.bankDetails.accountHolderName);
      console.log('   └─ Account Number:', `***${updatedSeller.bankDetails.accountNumber.slice(-4)}`);
      console.log('   └─ IFSC Code:', updatedSeller.bankDetails.ifscCode);
      console.log('   └─ Cancelled Cheque:', updatedSeller.bankDetails.cancelledCheque?.url ? 'Present' : 'Missing');
      console.log('   └─ Cheque Status:', updatedSeller.bankDetails.cancelledCheque?.status);

      console.log('\n🎯 NEXT STEPS:');
      console.log('='.repeat(20));
      console.log('1. ✅ Bank details are now complete');
      console.log('2. 🔄 Refresh your admin panel');
      console.log('3. 👀 Check User Management > Sellers > Bank Details tab');
      console.log('4. 🎉 Bank details should now be visible!');
    } else {
      console.log('❌ Failed to update bank details');
    }

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
};

console.log('🔧 Fixing Seller Bank Details...');
fixSellerBankDetails();

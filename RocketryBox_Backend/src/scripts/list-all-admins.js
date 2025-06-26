import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Admin from '../modules/admin/models/admin.model.js';

// Load environment variables
dotenv.config();

const listAllAdmins = async () => {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_ATLAS_URI || 'mongodb://localhost:27017/rocketrybox';
    await mongoose.connect(MONGODB_URI, {
      dbName: 'RocketryBox'
    });
    console.log('✅ Connected to MongoDB database: RocketryBox');

    // Find all admins
    const admins = await Admin.find({}).select('-password').sort({ createdAt: -1 });

    if (admins.length === 0) {
      console.log('❌ No admin accounts found!');
      return;
    }

    console.log('\n👥 ALL ADMIN ACCOUNTS');
    console.log('='.repeat(50));
    console.log(`Found ${admins.length} admin account(s)`);

    admins.forEach((admin, index) => {
      console.log(`\n${index + 1}️⃣ ADMIN ACCOUNT #${index + 1}`);
      console.log('─'.repeat(25));
      console.log('📧 Email:', admin.email);
      console.log('👤 Full Name:', admin.fullName);
      console.log('🆔 Employee ID:', admin.employeeId);
      console.log('🏢 Role:', admin.role);
      console.log('🏆 Is Super Admin:', admin.isSuperAdmin ? '✅ YES' : '❌ NO');
      console.log('✅ Status:', admin.status);
      console.log('🏢 Department:', admin.department);
      console.log('💼 Designation:', admin.designation);
      console.log('📞 Phone:', admin.phoneNumber);
      console.log('📅 Created:', admin.createdAt.toISOString().split('T')[0]);

      // Count granted permissions
      const grantedPermissions = Object.values(admin.permissions || {}).filter(Boolean).length;
      const totalPermissions = Object.keys(admin.permissions || {}).length;

      console.log(`🔐 Permissions: ${grantedPermissions}/${totalPermissions} granted`);

      if (admin.isSuperAdmin) {
        console.log('🎯 Access Level: FULL SYSTEM ACCESS');
      }
    });

    console.log('\n🔑 LOGIN CREDENTIALS SUMMARY:');
    console.log('='.repeat(40));

    const loginCredentials = [
      {
        email: 'superadmin@rocketrybox.com',
        password: 'SuperAdmin@2024!',
        name: 'System Super Administrator'
      },
      {
        email: 'admin@rocketrybox.com',
        password: 'Admin@123456',
        name: 'RocketryBox Administrator'
      }
    ];

    loginCredentials.forEach((cred, index) => {
      const adminExists = admins.find(a => a.email === cred.email);
      if (adminExists) {
        console.log(`${index + 1}️⃣ ${cred.name}`);
        console.log(`   📧 Email: ${cred.email}`);
        console.log(`   🔑 Password: ${cred.password}`);
        console.log(`   ✅ Status: Active & Ready`);
        console.log('');
      }
    });

    console.log('🎯 WHAT YOU CAN DO NOW:');
    console.log('='.repeat(30));
    console.log('1. 🚪 Log out from your seller account');
    console.log('2. 🌐 Go to admin login page');
    console.log('3. 🔐 Use any of the credentials above');
    console.log('4. 👥 Access User Management section');
    console.log('5. 👀 View both sellers and customers!');

    console.log('\n🛡️  SECURITY REMINDERS:');
    console.log('='.repeat(25));
    console.log('⚠️  Change passwords after first login');
    console.log('🔒 These accounts have FULL system access');
    console.log('🔄 Having multiple accounts provides backup access');
    console.log('👥 Both can manage all users and system operations');

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

console.log('👥 Listing All Admin Accounts...');
listAllAdmins();

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Admin from '../modules/admin/models/admin.model.js';
import { generateEmployeeId } from '../utils/employeeId.js';

// Load environment variables
dotenv.config();

const createSecondSuperAdmin = async () => {
  try {
    // Connect to MongoDB with explicit database name
    const MONGODB_URI = process.env.MONGODB_ATLAS_URI || 'mongodb://localhost:27017/rocketrybox';
    await mongoose.connect(MONGODB_URI, {
      dbName: 'RocketryBox'  // Force connection to RocketryBox database
    });
    console.log('✅ Connected to MongoDB database: RocketryBox');

    // Define second super admin details
    const superAdminEmail = 'admin@rocketrybox.com';

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: superAdminEmail });
    if (existingAdmin) {
      console.log('🗑️  Admin with this email already exists, deleting...');
      await Admin.deleteOne({ email: superAdminEmail });
    }

    // Generate employee ID
    const employeeId = await generateEmployeeId('Administration');
    console.log('🆔 Generated Employee ID:', employeeId);

    // Second super admin details with FULL PLATFORM ACCESS
    const superAdminData = {
      fullName: 'RocketryBox Administrator',
      email: superAdminEmail,
      password: 'Admin@123456', // Strong password
      role: 'Admin',                    // Highest role level
      designation: 'Platform Administrator',
      department: 'Administration',
      phoneNumber: '+919999888777',
      address: 'RocketryBox Operations Center',
      isSuperAdmin: true,              // CRITICAL: Super admin flag
      status: 'Active',                // Active status
      employeeId: employeeId,
      dateOfJoining: new Date(),
      lastLoginAt: new Date(),         // Set recent login
      lastActive: new Date(),          // Set as recently active
      remarks: 'Second Super Admin with COMPLETE platform access - All permissions enabled',

      // COMPLETE PERMISSIONS - ALL SET TO TRUE FOR FULL ACCESS
      permissions: {
        dashboardAccess: true,          // ✅ Dashboard and analytics access
        userManagement: true,           // ✅ Manage all users (sellers/customers)
        teamManagement: true,           // ✅ Manage admin team members
        ordersShipping: true,           // ✅ Orders and shipping management
        financialOperations: true,      // ✅ Financial operations and billing
        systemConfig: true,            // ✅ System configuration and settings
        sellerManagement: true,        // ✅ Seller management and verification
        supportTickets: true,          // ✅ Support ticket management
        reportsAnalytics: true,        // ✅ Reports and analytics
        marketingPromotions: true      // ✅ Marketing and promotions
      },

      // Additional admin configurations for complete access
      statusHistory: [{
        status: 'Active',
        reason: 'Super Admin account created with full permissions',
        timestamp: new Date()
      }]
    };

    // Create second super admin
    console.log('🚀 Creating second super admin...');
    const superAdmin = await Admin.create(superAdminData);

    // Verify creation and log details
    const createdAdmin = await Admin.findById(superAdmin._id).select('-password');

    console.log('\n🎉 SECOND SUPER ADMIN CREATED SUCCESSFULLY!');
    console.log('='.repeat(55));
    console.log('📧 Email:', createdAdmin.email);
    console.log('🔑 Password: Admin@123456');
    console.log('👤 Full Name:', createdAdmin.fullName);
    console.log('🏢 Role:', createdAdmin.role);
    console.log('🏆 Is Super Admin:', createdAdmin.isSuperAdmin);
    console.log('🆔 Employee ID:', createdAdmin.employeeId);
    console.log('📞 Phone:', createdAdmin.phoneNumber);
    console.log('🏢 Department:', createdAdmin.department);
    console.log('💼 Designation:', createdAdmin.designation);
    console.log('✅ Status:', createdAdmin.status);
    console.log('📅 Created At:', createdAdmin.createdAt);

    console.log('\n🔐 COMPLETE PERMISSIONS GRANTED:');
    console.log('='.repeat(35));
    Object.entries(createdAdmin.permissions).forEach(([permission, granted]) => {
      const status = granted ? '✅' : '❌';
      const permissionName = permission.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      console.log(`${status} ${permissionName} - ${granted ? 'FULL ACCESS' : 'NO ACCESS'}`);
    });

    console.log('\n🎯 SUPER ADMIN PRIVILEGES:');
    console.log('='.repeat(30));
    console.log('✅ Super Admin Flag: ENABLED');
    console.log('✅ Role Level: Admin (Highest)');
    console.log('✅ User Management: COMPLETE ACCESS');
    console.log('✅ Team Management: COMPLETE ACCESS');
    console.log('✅ System Configuration: COMPLETE ACCESS');
    console.log('✅ All Operations: UNRESTRICTED ACCESS');

    console.log('\n👥 NOW YOU HAVE 2 SUPER ADMINS:');
    console.log('='.repeat(35));
    console.log('1️⃣ superadmin@rocketrybox.com (Password: SuperAdmin@2024!)');
    console.log('2️⃣ admin@rocketrybox.com (Password: Admin@123456)');

    console.log('\n📝 LOGIN INSTRUCTIONS:');
    console.log('='.repeat(30));
    console.log('1. Navigate to the admin login page');
    console.log('2. Use either set of credentials:');
    console.log(`   📧 Email: ${createdAdmin.email}`);
    console.log('   🔑 Password: Admin@123456');
    console.log('   -- OR --');
    console.log('   📧 Email: superadmin@rocketrybox.com');
    console.log('   🔑 Password: SuperAdmin@2024!');
    console.log('3. Both accounts have COMPLETE admin access');

    console.log('\n✨ CONFIRMED FULL ACCESS TO:');
    console.log('='.repeat(30));
    console.log('🎯 User Management Dashboard');
    console.log('🎯 Seller Management & Verification');
    console.log('🎯 Team Management & Permissions');
    console.log('🎯 Orders & Shipping Operations');
    console.log('🎯 Financial Operations & Billing');
    console.log('🎯 System Configuration');
    console.log('🎯 Support Tickets & Customer Service');
    console.log('🎯 Reports & Analytics');
    console.log('🎯 Marketing & Promotions');
    console.log('🎯 ALL Backend Operations');

    console.log('\n🛡️  SECURITY NOTE:');
    console.log('='.repeat(20));
    console.log('⚠️  Please change passwords after first login');
    console.log('🔒 Both accounts have FULL system access');
    console.log('👥 You can now manage users, teams, and all operations');
    console.log('🔄 Having 2 accounts provides backup access');

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR CREATING SECOND SUPER ADMIN:');
    console.error('='.repeat(40));
    console.error('Error:', error.message);
    if (error.code === 11000) {
      console.error('💡 Suggestion: An admin with this email already exists');
    }
    console.error('\n📋 Full Error Details:');
    console.error(error);
    process.exit(1);
  }
};

// Run the script
console.log('🚀 Creating Second Super Admin...');
console.log('='.repeat(35));
createSecondSuperAdmin();

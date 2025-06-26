import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Admin from '../modules/admin/models/admin.model.js';
import { generateEmployeeId } from '../utils/employeeId.js';

// Load environment variables
dotenv.config();

const createComprehensiveSuperAdmin = async () => {
  try {
    // Connect to MongoDB with explicit database name
    const MONGODB_URI = process.env.MONGODB_ATLAS_URI || 'mongodb://localhost:27017/rocketrybox';
    await mongoose.connect(MONGODB_URI, {
      dbName: 'RocketryBox'  // Force connection to RocketryBox database
    });
    console.log('✅ Connected to MongoDB database: RocketryBox');

    // Define comprehensive super admin details
    const superAdminEmail = 'superadmin@rocketrybox.com';

    // Delete existing super admin if exists
    const existingAdmin = await Admin.findOne({ email: superAdminEmail });
    if (existingAdmin) {
      await Admin.deleteOne({ email: superAdminEmail });
      console.log('🗑️  Deleted existing super admin');
    }

    // Generate employee ID
    const employeeId = await generateEmployeeId('Administration');
    console.log('🆔 Generated Employee ID:', employeeId);

    // Super admin details with ALL permissions
    const superAdminData = {
      fullName: 'System Super Administrator',
      email: superAdminEmail,
      password: 'SuperAdmin@2024!', // Strong password
      role: 'Admin',
      designation: 'Chief System Administrator',
      department: 'Administration',
      phoneNumber: '+919876543210',
      address: 'RocketryBox HQ, Technology Park',
      isSuperAdmin: true,
      status: 'Active',
      employeeId: employeeId,
      dateOfJoining: new Date(),
      remarks: 'Comprehensive Super Admin with all system permissions',
      // ALL ADMIN PERMISSIONS SET TO TRUE
      permissions: {
        dashboardAccess: true,          // Dashboard access
        userManagement: true,           // Manage users (sellers/customers)
        teamManagement: true,           // Manage admin team members
        ordersShipping: true,           // Orders and shipping management
        financialOperations: true,      // Financial operations and billing
        systemConfig: true,            // System configuration
        sellerManagement: true,        // Seller management and verification
        supportTickets: true,          // Support ticket management
        reportsAnalytics: true,        // Reports and analytics
        marketingPromotions: true      // Marketing and promotions
      }
    };

    // Create super admin
    console.log('🚀 Creating super admin...');
    const superAdmin = await Admin.create(superAdminData);

    // Verify creation and log details
    const createdAdmin = await Admin.findById(superAdmin._id).select('-password');

    console.log('\n🎉 SUPER ADMIN CREATED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log('📧 Email:', createdAdmin.email);
    console.log('🔑 Password: SuperAdmin@2024!');
    console.log('👤 Full Name:', createdAdmin.fullName);
    console.log('🏢 Role:', createdAdmin.role);
    console.log('🏆 Is Super Admin:', createdAdmin.isSuperAdmin);
    console.log('🆔 Employee ID:', createdAdmin.employeeId);
    console.log('📞 Phone:', createdAdmin.phoneNumber);
    console.log('🏢 Department:', createdAdmin.department);
    console.log('💼 Designation:', createdAdmin.designation);
    console.log('✅ Status:', createdAdmin.status);
    console.log('📅 Created At:', createdAdmin.createdAt);

    console.log('\n🔐 PERMISSIONS GRANTED:');
    console.log('='.repeat(30));
    Object.entries(createdAdmin.permissions).forEach(([permission, granted]) => {
      const status = granted ? '✅' : '❌';
      const permissionName = permission.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      console.log(`${status} ${permissionName}`);
    });

    console.log('\n📝 LOGIN INSTRUCTIONS:');
    console.log('='.repeat(30));
    console.log('1. Navigate to the admin login page');
    console.log('2. Use the following credentials:');
    console.log(`   📧 Email: ${createdAdmin.email}`);
    console.log('   🔑 Password: SuperAdmin@2024!');
    console.log('3. You will have access to ALL admin features');

    console.log('\n🛡️  SECURITY NOTE:');
    console.log('='.repeat(20));
    console.log('⚠️  Please change the password after first login');
    console.log('🔒 This account has FULL system access');
    console.log('👥 You can now manage users, teams, and all system operations');

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR CREATING SUPER ADMIN:');
    console.error('='.repeat(35));
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
console.log('🚀 Starting Comprehensive Super Admin Creation...');
console.log('='.repeat(50));
createComprehensiveSuperAdmin();

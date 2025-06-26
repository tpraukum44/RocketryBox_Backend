import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import Admin from '../modules/admin/models/admin.model.js';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Super Admin Configuration
const SUPER_ADMIN_CONFIG = {
  fullName: 'Super Administrator',
  email: 'admin@rocketrybox.com',
  phoneNumber: '9999999999',
  password: 'SuperAdmin@123',
  role: 'Admin',
  department: 'Administration',
  designation: 'Super Administrator',
  address: 'RocketryBox Headquarters',
  employeeId: 'RB-ADMIN-001',
  isSuperAdmin: true,
  status: 'Active',
  remarks: 'System generated super admin account with full access',
  // Enable ALL permissions for super admin
  permissions: {
    // Core Access
    dashboardAccess: true,

    // Navigation Permissions - All Sidebar Items
    usersAccess: true,
    teamsAccess: true,
    partnersAccess: true,
    ordersAccess: true,
    shipmentsAccess: true,
    ticketsAccess: true,
    ndrAccess: true,
    billingAccess: true,
    reportsAccess: true,
    escalationAccess: true,
    settingsAccess: true,

    // Granular Operation Permissions
    userManagement: true,
    teamManagement: true,
    ordersShipping: true,
    financialOperations: true,
    systemConfig: true,
    sellerManagement: true,
    supportTickets: true,
    reportsAnalytics: true,
    marketingPromotions: true
  }
};

async function createSuperAdmin() {
  try {
    console.log('🚀 Starting Super Admin Creation Script...\n');

    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_ATLAS_URI || process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MongoDB URI not found in environment variables');
    }

    console.log('📝 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      dbName: 'RocketryBox'
    });
    console.log('✅ Connected to MongoDB successfully\n');

    // Check if super admin already exists
    console.log('🔍 Checking for existing super admin...');
    const existingSuperAdmin = await Admin.findOne({
      $or: [
        { email: SUPER_ADMIN_CONFIG.email },
        { isSuperAdmin: true },
        { employeeId: SUPER_ADMIN_CONFIG.employeeId }
      ]
    });

    if (existingSuperAdmin) {
      console.log('⚠️  Super admin already exists:');
      console.log(`   📧 Email: ${existingSuperAdmin.email}`);
      console.log(`   🆔 Employee ID: ${existingSuperAdmin.employeeId}`);
      console.log(`   👤 Name: ${existingSuperAdmin.fullName}`);
      console.log(`   🔑 Is Super Admin: ${existingSuperAdmin.isSuperAdmin}`);

      console.log('\n🤔 Do you want to:');
      console.log('   1. Skip creation (existing admin will remain)');
      console.log('   2. Update existing admin to super admin');
      console.log('   3. Delete existing and create new super admin');

      // For script automation, we'll update the existing admin
      console.log('\n🔄 Updating existing admin to super admin...');

      existingSuperAdmin.isSuperAdmin = true;
      existingSuperAdmin.role = 'Admin';
      existingSuperAdmin.permissions = SUPER_ADMIN_CONFIG.permissions;
      existingSuperAdmin.designation = 'Super Administrator';
      existingSuperAdmin.department = 'Administration';
      existingSuperAdmin.status = 'Active';

      await existingSuperAdmin.save();
      console.log('✅ Existing admin updated to super admin successfully!\n');

      await displayAdminDetails(existingSuperAdmin);
      return;
    }

    // Create new super admin
    console.log('👤 Creating new super admin account...');
    const superAdmin = new Admin(SUPER_ADMIN_CONFIG);
    await superAdmin.save();

    console.log('✅ Super admin created successfully!\n');

    // Display created admin details
    await displayAdminDetails(superAdmin);

  } catch (error) {
    console.error('❌ Error creating super admin:', error.message);
    if (error.code === 11000) {
      console.error('💡 Duplicate key error - admin with this email/employee ID already exists');
    }
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('\n📝 Database connection closed');
    process.exit(0);
  }
}

async function displayAdminDetails(admin) {
  console.log('🎉 SUPER ADMIN ACCOUNT DETAILS');
  console.log('==============================');
  console.log(`📧 Email: ${admin.email}`);
  console.log(`🔑 Password: ${SUPER_ADMIN_CONFIG.password}`);
  console.log(`👤 Full Name: ${admin.fullName}`);
  console.log(`📱 Phone: ${admin.phoneNumber}`);
  console.log(`🆔 Employee ID: ${admin.employeeId}`);
  console.log(`🏢 Department: ${admin.department}`);
  console.log(`💼 Designation: ${admin.designation}`);
  console.log(`🔐 Role: ${admin.role}`);
  console.log(`⭐ Super Admin: ${admin.isSuperAdmin ? 'Yes' : 'No'}`);
  console.log(`📅 Status: ${admin.status}`);
  console.log(`🗓️  Created: ${admin.createdAt.toISOString()}`);
  console.log('\n🔑 PERMISSIONS SUMMARY:');

  const permissions = admin.permissions;
  const enabledPermissions = Object.keys(permissions).filter(key => permissions[key]);
  console.log(`✅ Enabled: ${enabledPermissions.length}/${Object.keys(permissions).length} permissions`);

  console.log('\n📋 ACCESS LEVELS:');
  console.log(`   🎛️  Dashboard: ${permissions.dashboardAccess ? '✅' : '❌'}`);
  console.log(`   👥 Users: ${permissions.usersAccess ? '✅' : '❌'}`);
  console.log(`   🏢 Teams: ${permissions.teamsAccess ? '✅' : '❌'}`);
  console.log(`   🤝 Partners: ${permissions.partnersAccess ? '✅' : '❌'}`);
  console.log(`   📦 Orders: ${permissions.ordersAccess ? '✅' : '❌'}`);
  console.log(`   🚚 Shipments: ${permissions.shipmentsAccess ? '✅' : '❌'}`);
  console.log(`   🎫 Tickets: ${permissions.ticketsAccess ? '✅' : '❌'}`);
  console.log(`   📊 Reports: ${permissions.reportsAccess ? '✅' : '❌'}`);
  console.log(`   ⚙️  Settings: ${permissions.settingsAccess ? '✅' : '❌'}`);

  console.log('\n🌐 LOGIN INSTRUCTIONS:');
  console.log('========================');
  console.log('1. Go to: http://localhost:5173/admin/login');
  console.log(`2. Email: ${admin.email}`);
  console.log(`3. Password: ${SUPER_ADMIN_CONFIG.password}`);
  console.log('4. Click "Sign In"');

  console.log('\n🔒 SECURITY NOTES:');
  console.log('==================');
  console.log('• Change the password after first login');
  console.log('• Enable 2FA if available');
  console.log('• Review and adjust permissions as needed');
  console.log('• Monitor admin activities regularly');
}

// Additional helper function to reset super admin password
async function resetSuperAdminPassword(newPassword = 'NewSuperAdmin@123') {
  try {
    const MONGODB_URI = process.env.MONGODB_ATLAS_URI || process.env.MONGODB_URI;
    await mongoose.connect(MONGODB_URI, { dbName: 'RocketryBox' });

    const superAdmin = await Admin.findOne({ isSuperAdmin: true });
    if (!superAdmin) {
      console.log('❌ No super admin found');
      return;
    }

    superAdmin.password = newPassword;
    await superAdmin.save();

    console.log('✅ Super admin password reset successfully!');
    console.log(`📧 Email: ${superAdmin.email}`);
    console.log(`🔑 New Password: ${newPassword}`);

  } catch (error) {
    console.error('❌ Error resetting password:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === 'reset-password') {
    const newPassword = process.argv[3] || 'NewSuperAdmin@123';
    resetSuperAdminPassword(newPassword);
  } else {
    createSuperAdmin();
  }
}

export { createSuperAdmin, resetSuperAdminPassword };

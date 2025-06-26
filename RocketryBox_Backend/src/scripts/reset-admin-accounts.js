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

// Fresh Super Admin Configuration
const FRESH_SUPER_ADMIN = {
  fullName: 'Aerwok Super Administrator',
  email: 'aerwoktheweb@gmail.com',
  phoneNumber: '9999999999',
  password: 'Aerwok@2025',
  role: 'Admin',
  department: 'Administration',
  designation: 'Super Administrator',
  address: 'RocketryBox Headquarters',
  employeeId: 'RB-SA-001',
  isSuperAdmin: true,
  status: 'Active',
  remarks: 'Fresh super admin account created for aerwoktheweb@gmail.com',
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

async function resetAdminAccounts() {
  try {
    console.log('🚀 Starting Admin Account Reset Process...\n');

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

    // List existing admin accounts before deletion
    console.log('🔍 Checking existing admin accounts...');
    const existingAdmins = await Admin.find({}, 'fullName email role isSuperAdmin employeeId').sort({ createdAt: -1 });

    if (existingAdmins.length === 0) {
      console.log('📝 No existing admin accounts found.\n');
    } else {
      console.log(`📋 Found ${existingAdmins.length} existing admin account(s):`);
      existingAdmins.forEach((admin, index) => {
        console.log(`   ${index + 1}. ${admin.fullName} (${admin.email}) - ${admin.role} ${admin.isSuperAdmin ? '[SUPER ADMIN]' : ''}`);
      });
      console.log('');
    }

    // Confirm deletion (in automated script, we proceed)
    console.log('⚠️  PROCEEDING WITH DELETION OF ALL ADMIN ACCOUNTS...\n');

    // Delete ALL admin accounts
    console.log('🗑️  Deleting all existing admin accounts...');
    const deleteResult = await Admin.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} admin account(s)\n`);

    // Create fresh super admin
    console.log('👤 Creating fresh super admin account...');
    const freshSuperAdmin = new Admin(FRESH_SUPER_ADMIN);
    await freshSuperAdmin.save();

    console.log('✅ Fresh super admin created successfully!\n');

    // Display new admin details
    await displayFreshAdminDetails(freshSuperAdmin);

  } catch (error) {
    console.error('❌ Error resetting admin accounts:', error.message);
    if (error.code === 11000) {
      console.error('💡 Duplicate key error - this should not happen after deletion');
    }
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('\n📝 Database connection closed');
    process.exit(0);
  }
}

async function displayFreshAdminDetails(admin) {
  console.log('🎉 FRESH SUPER ADMIN ACCOUNT CREATED');
  console.log('====================================');
  console.log(`📧 Email: ${admin.email}`);
  console.log(`🔑 Password: ${FRESH_SUPER_ADMIN.password}`);
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
  console.log(`✅ Enabled: ${enabledPermissions.length}/${Object.keys(permissions).length} permissions (ALL ENABLED)`);

  console.log('\n📋 ACCESS LEVELS:');
  console.log(`   🎛️  Dashboard: ✅`);
  console.log(`   👥 Users: ✅`);
  console.log(`   🏢 Teams: ✅`);
  console.log(`   🤝 Partners: ✅`);
  console.log(`   📦 Orders: ✅`);
  console.log(`   🚚 Shipments: ✅`);
  console.log(`   🎫 Tickets: ✅`);
  console.log(`   📊 Reports: ✅`);
  console.log(`   💰 Billing: ✅`);
  console.log(`   ⚙️  Settings: ✅`);
  console.log(`   🚨 Escalation: ✅`);
  console.log(`   📈 Analytics: ✅`);

  console.log('\n🌐 LOGIN INSTRUCTIONS:');
  console.log('========================');
  console.log('1. Go to: http://localhost:5173/admin/login');
  console.log(`2. Email: ${admin.email}`);
  console.log(`3. Password: ${FRESH_SUPER_ADMIN.password}`);
  console.log('4. Click "Sign In"');

  console.log('\n🔒 SECURITY NOTES:');
  console.log('==================');
  console.log('• This is your ONLY admin account now');
  console.log('• Change the password after first login');
  console.log('• Consider creating additional admin accounts as needed');
  console.log('• All previous admin sessions are now invalid');
  console.log('• Fresh start with full administrative privileges');

  console.log('\n✨ RESET COMPLETED SUCCESSFULLY!');
  console.log('=================================');
  console.log('All old admin accounts have been removed and a');
  console.log('fresh super admin account has been created.');
}

// Safety check function - list what would be deleted
async function previewDeletion() {
  try {
    const MONGODB_URI = process.env.MONGODB_ATLAS_URI || process.env.MONGODB_URI;
    await mongoose.connect(MONGODB_URI, { dbName: 'RocketryBox' });

    const admins = await Admin.find({}, 'fullName email role isSuperAdmin employeeId createdAt').sort({ createdAt: -1 });

    console.log('🔍 ADMIN ACCOUNTS THAT WILL BE DELETED:');
    console.log('=======================================');

    if (admins.length === 0) {
      console.log('No admin accounts found to delete.');
    } else {
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. ${admin.fullName}`);
        console.log(`   📧 ${admin.email}`);
        console.log(`   🔐 ${admin.role} ${admin.isSuperAdmin ? '(Super Admin)' : ''}`);
        console.log(`   🆔 ${admin.employeeId}`);
        console.log(`   📅 Created: ${admin.createdAt.toDateString()}`);
        console.log('');
      });

      console.log(`⚠️  Total: ${admins.length} account(s) will be PERMANENTLY DELETED`);
      console.log('');
      console.log('To proceed with deletion and create fresh super admin, run:');
      console.log('node src/scripts/reset-admin-accounts.js confirm');
    }

  } catch (error) {
    console.error('❌ Error previewing deletion:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === 'confirm') {
    resetAdminAccounts();
  } else if (command === 'preview') {
    previewDeletion();
  } else {
    console.log('🚨 ADMIN ACCOUNT RESET SCRIPT');
    console.log('=============================');
    console.log('');
    console.log('⚠️  WARNING: This script will DELETE ALL existing admin accounts');
    console.log('and create a fresh super admin with aerwoktheweb@gmail.com');
    console.log('');
    console.log('Commands:');
    console.log('  preview  - Show what accounts will be deleted (SAFE)');
    console.log('  confirm  - Actually delete accounts and create fresh admin (DESTRUCTIVE)');
    console.log('');
    console.log('Examples:');
    console.log('  node src/scripts/reset-admin-accounts.js preview');
    console.log('  node src/scripts/reset-admin-accounts.js confirm');
  }
}

export { previewDeletion, resetAdminAccounts };

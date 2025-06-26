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

// Quick admin creation function
async function createQuickAdmin({
  email = 'admin@test.com',
  password = 'Admin@123',
  name = 'Test Administrator',
  phone = '9999999999',
  role = 'Admin',
  isSuperAdmin = false
} = {}) {

  try {
    console.log('🚀 Creating Quick Admin Account...\n');

    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_ATLAS_URI || process.env.MONGODB_URI;
    await mongoose.connect(MONGODB_URI, { dbName: 'RocketryBox' });
    console.log('✅ Connected to MongoDB\n');

    // Check if admin exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      console.log(`⚠️  Admin with email ${email} already exists!`);
      console.log(`   Current role: ${existingAdmin.role}`);
      console.log(`   Super admin: ${existingAdmin.isSuperAdmin}\n`);
      return;
    }

    // Generate employee ID
    const employeeId = `RB-${role.toUpperCase()}-${Date.now().toString().slice(-4)}`;

    // Create admin with all permissions if super admin
    const adminData = {
      fullName: name,
      email: email,
      phoneNumber: phone,
      password: password,
      role: role,
      department: 'Administration',
      designation: isSuperAdmin ? 'Super Administrator' : 'Administrator',
      employeeId: employeeId,
      isSuperAdmin: isSuperAdmin,
      status: 'Active',
      permissions: {
        dashboardAccess: true,
        usersAccess: isSuperAdmin,
        teamsAccess: isSuperAdmin,
        partnersAccess: isSuperAdmin,
        ordersAccess: true,
        shipmentsAccess: true,
        ticketsAccess: true,
        ndrAccess: isSuperAdmin,
        billingAccess: isSuperAdmin,
        reportsAccess: true,
        escalationAccess: isSuperAdmin,
        settingsAccess: isSuperAdmin,
        userManagement: isSuperAdmin,
        teamManagement: isSuperAdmin,
        ordersShipping: true,
        financialOperations: isSuperAdmin,
        systemConfig: isSuperAdmin,
        sellerManagement: isSuperAdmin,
        supportTickets: true,
        reportsAnalytics: true,
        marketingPromotions: isSuperAdmin
      }
    };

    const admin = new Admin(adminData);
    await admin.save();

    console.log('✅ Admin created successfully!\n');
    console.log('📋 ADMIN DETAILS:');
    console.log('=================');
    console.log(`📧 Email: ${admin.email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 Name: ${admin.fullName}`);
    console.log(`📱 Phone: ${admin.phoneNumber}`);
    console.log(`🆔 Employee ID: ${admin.employeeId}`);
    console.log(`🔐 Role: ${admin.role}`);
    console.log(`⭐ Super Admin: ${admin.isSuperAdmin ? 'Yes' : 'No'}`);
    console.log(`📅 Status: ${admin.status}\n`);

    console.log('🌐 LOGIN URL: http://localhost:5173/admin/login\n');

  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
  }
}

// List all admins
async function listAdmins() {
  try {
    const MONGODB_URI = process.env.MONGODB_ATLAS_URI || process.env.MONGODB_URI;
    await mongoose.connect(MONGODB_URI, { dbName: 'RocketryBox' });

    const admins = await Admin.find({}, 'fullName email role isSuperAdmin status employeeId createdAt').sort({ createdAt: -1 });

    console.log('👥 ALL ADMIN ACCOUNTS:');
    console.log('======================');

    if (admins.length === 0) {
      console.log('No admin accounts found.');
      return;
    }

    admins.forEach((admin, index) => {
      console.log(`\n${index + 1}. ${admin.fullName}`);
      console.log(`   📧 ${admin.email}`);
      console.log(`   🔐 ${admin.role} ${admin.isSuperAdmin ? '(Super Admin)' : ''}`);
      console.log(`   📅 ${admin.status}`);
      console.log(`   🆔 ${admin.employeeId}`);
      console.log(`   📅 Created: ${admin.createdAt.toDateString()}`);
    });

  } catch (error) {
    console.error('❌ Error listing admins:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  switch (command) {
    case 'create':
      const email = process.argv[3] || 'admin@test.com';
      const password = process.argv[4] || 'Admin@123';
      const name = process.argv[5] || 'Test Administrator';
      createQuickAdmin({ email, password, name });
      break;

    case 'super':
      const superEmail = process.argv[3] || 'superadmin@test.com';
      const superPassword = process.argv[4] || 'SuperAdmin@123';
      const superName = process.argv[5] || 'Super Administrator';
      createQuickAdmin({
        email: superEmail,
        password: superPassword,
        name: superName,
        isSuperAdmin: true
      });
      break;

    case 'list':
      listAdmins();
      break;

    default:
      console.log('🔧 QUICK ADMIN SCRIPT USAGE:');
      console.log('============================');
      console.log('');
      console.log('Create regular admin:');
      console.log('  node src/scripts/quick-admin.js create [email] [password] [name]');
      console.log('  Example: node src/scripts/quick-admin.js create admin@test.com Admin@123 "John Doe"');
      console.log('');
      console.log('Create super admin:');
      console.log('  node src/scripts/quick-admin.js super [email] [password] [name]');
      console.log('  Example: node src/scripts/quick-admin.js super super@test.com Super@123 "Super Admin"');
      console.log('');
      console.log('List all admins:');
      console.log('  node src/scripts/quick-admin.js list');
      console.log('');
      console.log('Default values:');
      console.log('  Email: admin@test.com');
      console.log('  Password: Admin@123');
      console.log('  Name: Test Administrator');
      break;
  }
}

export { createQuickAdmin, listAdmins };

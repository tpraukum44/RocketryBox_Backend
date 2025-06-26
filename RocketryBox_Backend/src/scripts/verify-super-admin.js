import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Admin from '../modules/admin/models/admin.model.js';

// Load environment variables
dotenv.config();

const verifySuperAdmin = async () => {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_ATLAS_URI || 'mongodb://localhost:27017/rocketrybox';
    await mongoose.connect(MONGODB_URI, {
      dbName: 'RocketryBox'
    });
    console.log('✅ Connected to MongoDB database: RocketryBox');

    // Find the super admin
    const superAdmin = await Admin.findOne({ email: 'superadmin@rocketrybox.com' });

    if (!superAdmin) {
      console.log('❌ Super admin not found!');
      return;
    }

    console.log('\n🔍 SUPER ADMIN VERIFICATION');
    console.log('='.repeat(40));
    console.log('📧 Email:', superAdmin.email);
    console.log('👤 Full Name:', superAdmin.fullName);
    console.log('🆔 Employee ID:', superAdmin.employeeId);
    console.log('🏢 Role:', superAdmin.role);
    console.log('🏆 Is Super Admin:', superAdmin.isSuperAdmin);
    console.log('✅ Status:', superAdmin.status);
    console.log('🏢 Department:', superAdmin.department);
    console.log('💼 Designation:', superAdmin.designation);

    console.log('\n🔐 DETAILED PERMISSIONS ANALYSIS:');
    console.log('='.repeat(45));

    const permissions = superAdmin.permissions;
    const permissionDescriptions = {
      dashboardAccess: {
        name: 'Dashboard Access',
        description: 'Full access to admin dashboard and overview'
      },
      userManagement: {
        name: 'User Management',
        description: 'Manage sellers and customers (THIS IS WHAT YOU NEEDED!)'
      },
      teamManagement: {
        name: 'Team Management',
        description: 'Manage admin team members and roles'
      },
      ordersShipping: {
        name: 'Orders & Shipping',
        description: 'Manage orders, shipments, and logistics'
      },
      financialOperations: {
        name: 'Financial Operations',
        description: 'Handle billing, payments, and financial data'
      },
      systemConfig: {
        name: 'System Configuration',
        description: 'Configure system settings and parameters'
      },
      sellerManagement: {
        name: 'Seller Management',
        description: 'Verify sellers, manage KYC, and agreements'
      },
      supportTickets: {
        name: 'Support Tickets',
        description: 'Handle customer support and ticket management'
      },
      reportsAnalytics: {
        name: 'Reports & Analytics',
        description: 'Access detailed reports and analytics'
      },
      marketingPromotions: {
        name: 'Marketing & Promotions',
        description: 'Manage marketing campaigns and promotions'
      }
    };

    let allPermissionsGranted = true;
    Object.entries(permissionDescriptions).forEach(([key, info]) => {
      const isGranted = permissions[key];
      const status = isGranted ? '✅' : '❌';
      allPermissionsGranted = allPermissionsGranted && isGranted;

      console.log(`${status} ${info.name}`);
      console.log(`   └─ ${info.description}`);
      if (key === 'userManagement' && isGranted) {
        console.log('   🎯 THIS PERMISSION SOLVES YOUR ORIGINAL ISSUE!');
      }
    });

    console.log('\n📊 SUMMARY:');
    console.log('='.repeat(20));
    if (allPermissionsGranted) {
      console.log('🟢 ALL PERMISSIONS GRANTED - FULL ACCESS CONFIRMED!');
    } else {
      console.log('🟡 Some permissions missing');
    }

    console.log('\n🔑 LOGIN CREDENTIALS:');
    console.log('='.repeat(25));
    console.log('📧 Email: superadmin@rocketrybox.com');
    console.log('🔑 Password: SuperAdmin@2024!');
    console.log('🌐 URL: /admin/login (or your admin login route)');

    console.log('\n🎯 NEXT STEPS:');
    console.log('='.repeat(15));
    console.log('1. 🚪 Log out from your current seller account');
    console.log('2. 🌐 Navigate to the admin login page');
    console.log('3. 🔐 Login with the credentials above');
    console.log('4. 👥 Access User Management section');
    console.log('5. 👀 You should now see both sellers and customers!');

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

console.log('🔍 Verifying Super Admin Permissions...');
verifySuperAdmin();

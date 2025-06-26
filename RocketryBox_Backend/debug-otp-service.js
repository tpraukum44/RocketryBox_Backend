import { SESClient } from '@aws-sdk/client-ses';
import axios from 'axios';
import { createClient } from 'redis';

console.log('🔍 OTP Service Diagnostic Tool');
console.log('================================\n');

// Test Environment Variables
console.log('1. Environment Variables Check:');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'Not set');
console.log('   REDIS_PASSWORD:', process.env.REDIS_PASSWORD ? 'Set ✅' : 'Missing ❌');
console.log('   FAST2SMS_API_KEY:', process.env.FAST2SMS_API_KEY ? 'Set ✅' : 'Missing ❌');
console.log('   JWT_SECRET:', process.env.JWT_SECRET ? 'Set ✅' : 'Missing ❌');
console.log('   AWS_REGION:', process.env.AWS_REGION || 'Not set');
console.log('   AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'Set ✅' : 'Missing ❌');
console.log('   AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'Set ✅' : 'Missing ❌');
console.log('');

// Test Redis Connection
console.log('2. Redis Connection Test:');
const testRedis = async () => {
  try {
    const REDIS_HOST = 'redis-15903.c38978.ap-south-1-mz.ec2.cloud.rlrcp.com';
    const REDIS_PORT = '15903';
    const REDIS_USERNAME = 'default';
    const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

    if (!REDIS_PASSWORD) {
      console.log('   ❌ Redis password not configured');
      return false;
    }

    const REDIS_URL = `redis://${REDIS_USERNAME}:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`;

    const redisClient = createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout: 5000
      }
    });

    console.log('   Attempting to connect to Redis...');
    await redisClient.connect();
    console.log('   ✅ Redis connection successful');

    // Test OTP storage
    await redisClient.setEx('test_otp', 300, JSON.stringify({ code: '123456', attempts: 0 }));
    const testData = await redisClient.get('test_otp');
    console.log('   ✅ Redis OTP storage test successful');

    await redisClient.del('test_otp');
    await redisClient.disconnect();
    return true;
  } catch (error) {
    console.log('   ❌ Redis connection failed:', error.message);
    return false;
  }
};

// Test SMS Service
console.log('3. SMS Service (Fast2SMS) Test:');
const testSMS = async () => {
  try {
    const apiKey = process.env.FAST2SMS_API_KEY;

    if (!apiKey) {
      console.log('   ❌ Fast2SMS API key not configured');
      return false;
    }

    console.log('   Testing Fast2SMS API endpoint...');

    // Test with a safe DLT template
    const response = await axios({
      method: 'POST',
      url: 'https://www.fast2sms.com/dev/bulkV2',
      headers: {
        'Content-Type': 'application/json',
        'authorization': apiKey
      },
      data: {
        route: 'dlt',
        sender_id: 'RBXOTP',
        message: '184297',
        variables_values: 'Test|123456|5',
        numbers: '9999999999' // Test number
      },
      timeout: 10000
    });

    if (response.data.return === true) {
      console.log('   ✅ Fast2SMS API connection successful');
      return true;
    } else {
      console.log('   ⚠️ Fast2SMS API returned:', response.data.message);
      return false;
    }
  } catch (error) {
    console.log('   ❌ Fast2SMS API test failed:', error.response?.data?.message || error.message);
    return false;
  }
};

// Test Email Service
console.log('4. Email Service (AWS SES) Test:');
const testEmail = async () => {
  try {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!region || !accessKeyId || !secretAccessKey) {
      console.log('   ❌ AWS credentials not properly configured');
      return false;
    }

    const sesClient = new SESClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });

    console.log('   ✅ AWS SES client initialized successfully');
    return true;
  } catch (error) {
    console.log('   ❌ AWS SES initialization failed:', error.message);
    return false;
  }
};

// Run all tests
const runDiagnostics = async () => {
  console.log('Running diagnostic tests...\n');

  const redisResult = await testRedis();
  console.log('');

  const smsResult = await testSMS();
  console.log('');

  const emailResult = await testEmail();
  console.log('');

  console.log('📋 Diagnostic Summary:');
  console.log('======================');
  console.log('Redis Service:', redisResult ? '✅ Working' : '❌ Failed');
  console.log('SMS Service:', smsResult ? '✅ Working' : '❌ Failed');
  console.log('Email Service:', emailResult ? '✅ Working' : '❌ Failed');
  console.log('');

  if (!redisResult) {
    console.log('🔧 Redis Fix: Check REDIS_PASSWORD in .env file');
  }

  if (!smsResult) {
    console.log('🔧 SMS Fix: Check FAST2SMS_API_KEY in .env file');
    console.log('   Also verify DLT templates are approved');
  }

  if (!emailResult) {
    console.log('🔧 Email Fix: Check AWS credentials in .env file');
  }

  console.log('');
  console.log('Next steps:');
  console.log('1. Fix any failed services above');
  console.log('2. Restart the backend server: npm restart');
  console.log('3. Test OTP functionality again');
};

runDiagnostics().catch(console.error);

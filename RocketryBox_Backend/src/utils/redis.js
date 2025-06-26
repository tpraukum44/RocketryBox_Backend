import { createClient } from 'redis';
import { logger } from './logger.js';

// Redis connection details - hardcoded configuration
const REDIS_HOST = 'redis-15903.c38978.ap-south-1-mz.ec2.cloud.rlrcp.com';
const REDIS_PORT = '15903';
const REDIS_USERNAME = 'default';
// Redis password comes from environment variable (sensitive credential)
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

// TTL Constants - hardcoded values
const REDIS_TTL = 3600; // 1 hour
const REDIS_OTP_TTL = 300; // 5 minutes
const REDIS_SESSION_TTL = 86400; // 24 hours
const REDIS_DB = 0; // Redis database number

// Construct Redis URL with username and password
const REDIS_URL = `redis://${REDIS_USERNAME}:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`;

// DISABLED: Redis Connection Details console logs
// console.log('🔍 Redis Connection Details:');
// console.log(`   Host: ${REDIS_HOST}`);
// console.log(`   Port: ${REDIS_PORT}`);
// console.log(`   Username: ${REDIS_USERNAME}`);
// console.log(`   Password: ${REDIS_PASSWORD ? REDIS_PASSWORD.substring(0, 10) + '...' : 'Not set'}`);
// console.log(`   URL: redis://${REDIS_USERNAME}:***@${REDIS_HOST}:${REDIS_PORT}`);

// Create Redis client
let redisClient;
let isConnecting = false;

const createRedisClient = () => {
  try {
    logger.info('Creating Redis client...');
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            logger.error(`Failed to connect to Redis after ${retries} attempts`);
            return false; // stop retrying
          }
          const delay = Math.min(retries * 1000, 5000);
          logger.debug(`Redis reconnect attempt ${retries} in ${delay}ms`);
          return delay;
        },
        connectTimeout: 10000,
        lazyConnect: true
      }
    });

    // Handle Redis events
    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err.message);
      isConnecting = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis Client Connected');
      isConnecting = false;
    });

    redisClient.on('ready', () => {
      logger.info('Redis Client Ready');
      isConnecting = false;
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis Client Reconnecting');
      isConnecting = true;
    });

    redisClient.on('end', () => {
      logger.info('Redis Client Connection Ended');
      isConnecting = false;
    });

    return redisClient;
  } catch (error) {
    logger.error('Error creating Redis client:', error.message);
    isConnecting = false;
    return null;
  }
};

// Initialize Redis client
redisClient = createRedisClient();

// Connect to Redis
export const connectRedis = async () => {
  if (!redisClient) {
    redisClient = createRedisClient();
  }

  if (redisClient?.isOpen) {
    logger.info('Redis already connected');
    return true;
  }

  if (isConnecting) {
    logger.info('Redis connection already in progress...');
    return false;
  }

  try {
    isConnecting = true;
    logger.info('Connecting to Redis...');
    await redisClient.connect();
    logger.info('Redis connected successfully');
    isConnecting = false;
    return true;
  } catch (error) {
    logger.error('Error connecting to Redis:', error.message);
    isConnecting = false;
    return false;
  }
};

// Ensure Redis is connected before operations
const ensureRedisConnection = async () => {
  if (!redisClient?.isOpen && !isConnecting) {
    logger.info('Redis not connected, attempting to connect...');
    await connectRedis();
  }
  return redisClient?.isOpen || false;
};

// Helper function to check if Redis is connected
const isRedisConnected = () => {
  return redisClient?.isOpen || false;
};

// Export Redis health check
export const isRedisHealthy = () => {
  return {
    connected: redisClient.isOpen,
    clientOpen: redisClient.isOpen
  };
};

// Session Management
export const setSession = async (userId, sessionData, expiryInSeconds = REDIS_SESSION_TTL) => {
  const connected = await ensureRedisConnection();
  if (!connected) {
    logger.warn('Redis unavailable, session not stored');
    return false;
  }

  const key = `session:${userId}`;
  const value = JSON.stringify(sessionData);
  await redisClient.setEx(key, expiryInSeconds, value);
  return true;
};

export const getSession = async (userId) => {
  const connected = await ensureRedisConnection();
  if (!connected) {
    logger.warn('Redis unavailable, returning null session');
    return null;
  }

  const key = `session:${userId}`;
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
};

export const deleteSession = async (userId) => {
  const connected = await ensureRedisConnection();
  if (!connected) {
    logger.warn('Redis unavailable, session not deleted');
    return false;
  }

  const key = `session:${userId}`;
  await redisClient.del(key);
  return true;
};

// OTP Management
export const setOTP = async (userId, otp, expiryInSeconds = REDIS_OTP_TTL) => {
  const connected = await ensureRedisConnection();
  if (!connected) {
    logger.warn('Redis unavailable, OTP not stored');
    return false;
  }

  const key = `otp:${userId}`;
  const data = {
    code: otp,
    attempts: 0,
    createdAt: Date.now()
  };
  const value = JSON.stringify(data);
  await redisClient.setEx(key, expiryInSeconds, value);
  return true;
};

export const getOTP = async (userId) => {
  const connected = await ensureRedisConnection();
  if (!connected) {
    logger.warn('Redis unavailable, returning null OTP');
    return null;
  }

  const key = `otp:${userId}`;
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
};

export const verifyOTP = async (userId, inputOTP) => {
  const connected = await ensureRedisConnection();
  if (!connected) {
    logger.warn('Redis unavailable for OTP verification');

    // Development fallback - check in-memory cache
    if (process.env.NODE_ENV === 'development' && global.devOtpCache) {
      // Try multiple key formats to ensure compatibility
      const possibleKeys = [
        `otp:${userId}`,
        userId,
        `temp_${userId}`
      ];

      let otpData = null;
      let foundKey = null;

      for (const key of possibleKeys) {
        otpData = global.devOtpCache.get(key);
        if (otpData) {
          foundKey = key;
          break;
        }
      }

      if (!otpData) {
        console.log('🔧 Development: OTP not found in memory cache for any key format');
        console.log('🔧 Available keys:', Array.from(global.devOtpCache.keys()));
        return { valid: false, message: 'OTP expired or not found' };
      }

      console.log(`🔧 Development: Found OTP with key: ${foundKey}`);

      // Check if expired
      if (Date.now() > otpData.expiry) {
        // Clean up all possible keys
        possibleKeys.forEach(key => global.devOtpCache.delete(key));
        console.log('🔧 Development: OTP expired in memory cache');
        return { valid: false, message: 'OTP expired or not found' };
      }

      // Check attempts
      const maxAttempts = 3;
      if (otpData.attempts >= maxAttempts) {
        // Clean up all possible keys
        possibleKeys.forEach(key => global.devOtpCache.delete(key));
        console.log('🔧 Development: Maximum OTP attempts exceeded in memory cache');
        return { valid: false, message: 'Maximum attempts exceeded' };
      }

      // Update attempts
      otpData.attempts += 1;

      // Verify OTP
      if (otpData.code !== inputOTP) {
        console.log(`🔧 Development: Invalid OTP in memory cache. Expected: ${otpData.code}, Got: ${inputOTP}`);
        return {
          valid: false,
          message: 'Invalid OTP',
          remainingAttempts: maxAttempts - otpData.attempts
        };
      }

      // OTP verified, clean up all possible keys
      possibleKeys.forEach(key => global.devOtpCache.delete(key));
      console.log('✅ Development: OTP verified successfully from memory cache');
      return { valid: true, message: 'OTP verified successfully' };
    }

    return { valid: false, message: 'Service temporarily unavailable' };
  }

  const key = `otp:${userId}`;
  const data = await redisClient.get(key);

  if (!data) return { valid: false, message: 'OTP expired or not found' };

  const otpData = JSON.parse(data);

  // Check attempts
  const maxAttempts = 3;
  if (otpData.attempts >= maxAttempts) {
    await redisClient.del(key);
    return { valid: false, message: 'Maximum attempts exceeded' };
  }

  // Update attempts
  otpData.attempts += 1;
  const value = JSON.stringify(otpData);
  await redisClient.setEx(key, 300, value);

  // Verify OTP
  if (otpData.code !== inputOTP) {
    return {
      valid: false,
      message: 'Invalid OTP',
      remainingAttempts: maxAttempts - otpData.attempts
    };
  }

  // OTP verified, clean up
  await redisClient.del(key);
  return { valid: true, message: 'OTP verified successfully' };
};

// Rate Limiting
export const checkRateLimit = async (key, limit, windowInSeconds) => {
  const connected = await ensureRedisConnection();
  if (!connected) {
    logger.warn('Redis unavailable, allowing request');
    return {
      current: 1,
      isAllowed: true,
      remainingAttempts: limit - 1
    };
  }

  const current = await redisClient.incr(key);
  if (current === 1) {
    await redisClient.expire(key, windowInSeconds);
  }

  return {
    current,
    isAllowed: current <= limit,
    remainingAttempts: Math.max(0, limit - current)
  };
};

// Cache Management
export const setCache = async (key, data, expiryInSeconds = REDIS_TTL) => {
  const connected = await ensureRedisConnection();
  if (!connected) {
    logger.warn('Redis unavailable, cache not stored');
    return false;
  }

  if (!key) {
    throw new Error('Key cannot be null or undefined');
  }

  const safeData = data === undefined ? null : data;
  const value = JSON.stringify(safeData);
  await redisClient.setEx(key, expiryInSeconds, value);
  return true;
};

export const getCache = async (key) => {
  const connected = await ensureRedisConnection();
  if (!connected) {
    logger.warn('Redis unavailable, returning null cache');
    return null;
  }

  if (!key) {
    throw new Error('Key cannot be null or undefined');
  }

  const data = await redisClient.get(key);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch (parseError) {
    logger.error(`Redis Parse Error for key ${key}:`, parseError.message);
    return null;
  }
};

export const deleteCache = async (key) => {
  const connected = await ensureRedisConnection();
  if (!connected) {
    logger.warn('Redis unavailable, cache not deleted');
    return false;
  }

  if (!key) {
    throw new Error('Key cannot be null or undefined');
  }

  await redisClient.del(key);
  return true;
};

export const getAllSessions = async () => {
  const connected = await ensureRedisConnection();
  if (!connected) {
    logger.warn('Redis unavailable, returning empty sessions');
    return [];
  }

  const keys = await redisClient.keys('session:*');
  if (!keys || keys.length === 0) return [];

  const sessions = [];
  for (const key of keys) {
    const data = await redisClient.get(key);
    if (data) {
      const userId = key.split(':')[1];
      sessions.push({
        userId,
        data: JSON.parse(data)
      });
    }
  }

  return sessions;
};

export const storeOTP = async (phone, otp, expiryInSeconds = 300) => {
  const connected = await ensureRedisConnection();
  if (!connected) {
    logger.warn('Redis unavailable, OTP not stored');
    return false;
  }

  const key = `phone_otp:${phone}`;
  const data = {
    code: otp,
    attempts: 0,
    createdAt: Date.now()
  };
  const value = JSON.stringify(data);
  await redisClient.setEx(key, expiryInSeconds, value);
  return true;
};

// For compatibility with code that expects the redis client directly
export default redisClient;

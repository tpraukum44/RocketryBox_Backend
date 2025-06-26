import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { loadEnvironmentFromSSM } from './loadEnv.js';
import { connectRedis } from './utils/redis.js';
import { initSocketIO } from './utils/socketio.js';

const app = express();
const server = createServer(app);

// ----------- 1. ENV INITIALIZATION -----------

async function initializeEnv() {
  console.log('🚀 Starting environment setup...');
  try {
    await loadEnvironmentFromSSM(); // Optional in prod
    console.log('✅ SSM parameters loaded');
  } catch (error) {
    console.warn('⚠️ Failed to load from SSM:', error.message);
  }

  dotenv.config({ path: './.env' }); // fallback to .env file
  console.log('📄 Loaded .env file from:', process.cwd());
  
  // Temporary fix: Set MongoDB URI directly if not loaded from .env
  if (!process.env.MONGODB_ATLAS_URI) {
    process.env.MONGODB_ATLAS_URI = 'mongodb+srv://admin:4fepc6nQ11I1fztL@rocketrybox.lmdlxtz.mongodb.net/?retryWrites=true&w=majority&appName=RocketryBox';
    console.log('⚠️ Manually set MONGODB_ATLAS_URI (dotenv failed)');
  }
  
  process.env.NODE_ENV ||= 'development';
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
}

// ----------- 2. SERVICE CONNECTIONS -----------

async function initializeServices() {
  
  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found. Exiting...');
    return process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(mongoUri, {
    dbName: 'RocketryBox',
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  });
  console.log('✅ MongoDB connected');

  try {
    const redisConnected = await connectRedis();
    if (redisConnected) console.log('✅ Redis connected');
    else console.warn('⚠️ Redis not connected, continuing...');
  } catch (err) {
    console.warn('❌ Redis error, continuing:', err.message);
  }
}

// ----------- 3. MIDDLEWARE + ROUTES -----------

function setupApp() {
  app.set('trust proxy', 1);
  app.use(express.json());

  // Root route
  app.get('/', (req, res) => {
    res.status(200).json({
      name: 'RocketryBox Backend API',
      version: '1.0.0',
      status: 'Online',
      environment: process.env.NODE_ENV,
      message: 'Welcome to RocketryBox Backend API',
      endpoints: {
        health: '/health',
        ping: '/ping',
        api_test: '/api/test'
      },
      timestamp: new Date().toISOString()
    });
  });

  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      env: process.env.NODE_ENV,
      port: process.env.PORT,
      timestamp: new Date().toISOString()
    });
  });

  app.get('/ping', (req, res) => res.send('pong'));

  // API route test
  app.get('/api/test', (req, res) => {
    res.json({ message: 'API working!' });
  });
}

// ----------- 4. START SERVER -----------

async function startServer() {
  await initializeEnv();
  await initializeServices();
  setupApp();
  initSocketIO(server); // attach WebSocket to HTTP server

  const PORT = process.env.PORT || 8000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('🌐 Nginx will proxy from port 80 to Node.js on port', PORT);
  });
}

startServer().catch(err => {
  console.error('💥 Startup error:', err);
  process.exit(1);
});

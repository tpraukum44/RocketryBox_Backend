import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { logger } from './logger.js';

let io;
const connectedAdmins = new Map(); // Track connected admin clients

/**
 * Authenticate socket connection with JWT
 * @param {Object} socket - Socket instance
 * @param {Function} next - Next function
 */
const authenticateSocket = (socket, next) => {
  // Get token from auth object or query param
  const token = socket.handshake.auth.token || socket.handshake.query.token;

  if (!token) {
    return next(new Error('Authentication token required'));
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Set user data on socket
    socket.user = {
      id: decoded.id,
      role: decoded.role
    };

    next();
  } catch (error) {
    logger.warn(`Socket auth failed: ${error.message}`);
    next(new Error('Authentication failed'));
  }
};

/**
 * Initialize Socket.IO server
 * @param {object} server - HTTP server instance
 */
export const initSocketIO = (server) => {
  io = new Server(server, {
    cors: {
      origin: ["https://www.rocketrybox.com"], // or S3 URL if testing
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["websocket"],
    pingTimeout: 30000, // Increase default ping timeout
    pingInterval: 20000, // Increase ping interval
    maxHttpBufferSize: 1e6, // 1MB max payload size
    perMessageDeflate: true, // Enable compression
  });

  // Set up authentication middleware
  io.use(authenticateSocket);

  // Connection event handling
  io.on('connection', (socket) => {
    const userId = socket.user?.id;
    const userRole = socket.user?.role;

    // DISABLED: Socket.IO connection logging
    // logger.info(`New client connected: ${socket.id} (User: ${userId}, Role: ${userRole})`);

    // Tracking connection metrics
    if (userRole === 'Admin') {
      connectedAdmins.set(socket.id, {
        userId,
        connectedAt: new Date(),
        lastActivity: new Date()
      });

      // Log when we reach connection thresholds
      if (connectedAdmins.size % 10 === 0) {
        logger.info(`Connected admin clients: ${connectedAdmins.size}`);
      }
    }

    // Join admin dashboard room if admin
    socket.on('join-admin-dashboard', () => {
      if (userRole !== 'Admin' && userRole !== 'Manager') {
        socket.emit('error', { message: 'Permission denied' });
        return;
      }

      socket.join('admin-dashboard');
      // DISABLED: Dashboard room join logging
      // logger.info(`Client ${socket.id} (User: ${userId}) joined admin-dashboard room`);

      // Update last activity
      if (connectedAdmins.has(socket.id)) {
        connectedAdmins.get(socket.id).lastActivity = new Date();
      }
    });

    // Join seller-specific room for real-time order updates
    socket.on('join-room', (roomName) => {
      if (!roomName || typeof roomName !== 'string') {
        socket.emit('error', { message: 'Invalid room name' });
        return;
      }

      // Security check: sellers can only join their own rooms
      if (userRole === 'seller' && roomName.startsWith('seller-')) {
        const requestedSellerId = roomName.replace('seller-', '');
        if (requestedSellerId !== userId) {
          socket.emit('error', { message: 'Permission denied: Cannot join other seller rooms' });
          return;
        }
      }

      // Admin and Manager can join any room
      if (userRole === 'Admin' || userRole === 'Manager' ||
        (userRole === 'seller' && roomName === `seller-${userId}`)) {
        socket.join(roomName);
        logger.info(`Client ${socket.id} (${userRole}: ${userId}) joined room: ${roomName}`);

        socket.emit('room-joined', {
          room: roomName,
          timestamp: new Date(),
          userRole: userRole
        });
      } else {
        socket.emit('error', { message: 'Permission denied for this room' });
      }
    });

    // Leave room handler
    socket.on('leave-room', (roomName) => {
      if (!roomName || typeof roomName !== 'string') {
        return;
      }

      socket.leave(roomName);
      logger.info(`Client ${socket.id} left room: ${roomName}`);

      socket.emit('room-left', {
        room: roomName,
        timestamp: new Date()
      });
    });

    // Subscribe to specific users for real-time updates
    socket.on('subscribe-users', (data) => {
      if (userRole !== 'Admin' && userRole !== 'Manager' && userRole !== 'Support') {
        socket.emit('error', { message: 'Permission denied' });
        return;
      }

      // Validate input
      if (!data || !Array.isArray(data.sellerIds) || !Array.isArray(data.customerIds)) {
        socket.emit('error', { message: 'Invalid subscription data format' });
        return;
      }

      // Limit the number of subscriptions to prevent abuse
      const MAX_SUBSCRIPTIONS = 50;
      if (data.sellerIds.length + data.customerIds.length > MAX_SUBSCRIPTIONS) {
        socket.emit('error', { message: `Too many subscriptions requested. Maximum ${MAX_SUBSCRIPTIONS} total allowed` });
        return;
      }

      // Join rooms for each seller
      data.sellerIds.forEach(sellerId => {
        if (sellerId && typeof sellerId === 'string') {
          socket.join(`admin-seller-${sellerId}`);
        }
      });

      // Join rooms for each customer
      data.customerIds.forEach(customerId => {
        if (customerId && typeof customerId === 'string') {
          socket.join(`admin-customer-${customerId}`);
        }
      });

      logger.debug(`Client ${socket.id} subscribed to ${data.sellerIds.length} sellers and ${data.customerIds.length} customers`);

      // Update last activity
      if (connectedAdmins.has(socket.id)) {
        connectedAdmins.get(socket.id).lastActivity = new Date();
      }

      // Confirm subscription
      socket.emit('users-subscription-success', {
        subscribed: {
          sellers: data.sellerIds,
          customers: data.customerIds
        },
        timestamp: new Date()
      });
    });

    // Unsubscribe from specific users
    socket.on('unsubscribe-users', (data) => {
      if (!data || !Array.isArray(data.sellerIds) || !Array.isArray(data.customerIds)) {
        return;
      }

      // Leave rooms for each seller
      data.sellerIds.forEach(sellerId => {
        if (sellerId && typeof sellerId === 'string') {
          socket.leave(`admin-seller-${sellerId}`);
        }
      });

      // Leave rooms for each customer
      data.customerIds.forEach(customerId => {
        if (customerId && typeof customerId === 'string') {
          socket.leave(`admin-customer-${customerId}`);
        }
      });

      logger.debug(`Client ${socket.id} unsubscribed from users`);

      // Update last activity
      if (connectedAdmins.has(socket.id)) {
        connectedAdmins.get(socket.id).lastActivity = new Date();
      }
    });

    // Subscribe to specific dashboard sections
    socket.on('subscribe-section', (section) => {
      if (userRole !== 'Admin' && userRole !== 'Manager') {
        socket.emit('error', { message: 'Permission denied' });
        return;
      }

      const validSections = ['users', 'orders', 'revenue', 'products', 'activities'];
      if (!validSections.includes(section)) {
        socket.emit('error', { message: 'Invalid section' });
        return;
      }

      // Join section-specific room
      socket.join(`admin-dashboard-${section}`);
      logger.debug(`Client ${socket.id} subscribed to section: ${section}`);

      // Update last activity
      if (connectedAdmins.has(socket.id)) {
        connectedAdmins.get(socket.id).lastActivity = new Date();
      }
    });

    // Client requested refresh explicitly
    socket.on('refresh-dashboard', () => {
      if (userRole !== 'Admin' && userRole !== 'Manager') {
        socket.emit('error', { message: 'Permission denied' });
        return;
      }

      // Emit refresh request event
      socket.emit('refresh-requested', { timestamp: new Date() });

      // Update last activity
      if (connectedAdmins.has(socket.id)) {
        connectedAdmins.get(socket.id).lastActivity = new Date();
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id} (User: ${userId})`);

      // Clean up tracking
      if (connectedAdmins.has(socket.id)) {
        connectedAdmins.delete(socket.id);
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}: ${error.message}`);
    });
  });

  // Log connection statistics periodically
  setInterval(() => {
    const totalConnections = io.engine.clientsCount;
    const adminConnections = connectedAdmins.size;
    const metrics = {
      totalConnections,
      adminConnections,
      timestamp: new Date()
    };

    logger.debug('Socket.IO connection metrics', metrics);

    // Cleanup inactive admin connections (inactive for more than 30 minutes)
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [socketId, data] of connectedAdmins.entries()) {
      if (now - data.lastActivity > inactiveThreshold) {
        logger.info(`Removing inactive admin connection: ${socketId}`);
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
        connectedAdmins.delete(socketId);
      }
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  logger.info('Socket.IO initialized');
  return io;
};

/**
 * Get Socket.IO instance
 * @returns {object} Socket.IO instance
 */
export const getIO = () => {
  if (!io) {
    logger.warn('Socket.IO not initialized, returning mock instance');

    // Return a mock IO instance that does nothing but logs
    return {
      to: () => ({
        emit: (event, data) => {
          logger.debug(`[MOCK SOCKET.IO] would emit '${event}' with data:`, data);
          return true;
        }
      }),
      emit: (event, data) => {
        logger.debug(`[MOCK SOCKET.IO] would emit '${event}' with data:`, data);
        return true;
      },
      on: () => { },
      engine: { clientsCount: 0 },
      sockets: {
        sockets: new Map(),
        adapter: { rooms: new Map() }
      }
    };
  }
  return io;
};

/**
 * Get connected admin count
 * @returns {number} Number of connected admin clients
 */
export const getConnectedAdminCount = () => {
  return connectedAdmins.size;
};

/**
 * Emit update to admin dashboard
 * @param {string} event - Event name
 * @param {object} data - Data to emit
 */
export const emitAdminDashboardUpdate = (event, data) => {
  // Use getIO instead of checking io directly to leverage the mock implementation
  const socketIo = getIO();

  // If no admin clients are connected, don't bother emitting
  if (connectedAdmins.size === 0) {
    logger.debug('No admin clients connected, skipping dashboard update');
    return;
  }

  try {
    // For section-specific updates, only emit to the specific section room
    if (event === 'dashboard-section-update' && data) {
      // Get section name
      const section = Object.keys(data).find(key =>
        key !== 'timestamp' && typeof data[key] === 'object'
      );

      if (section) {
        const roomName = `admin-dashboard-${section}`;
        socketIo.to(roomName).emit(event, data);
        logger.debug(`Emitted ${event} to ${roomName} room`);
        return;
      }
    }

    // For complete dashboard updates, emit to the main dashboard room
    socketIo.to('admin-dashboard').emit(event, data);
    logger.debug(`Emitted ${event} to admin-dashboard room`);

    // Add timestamp and compression metrics in development mode
    if (process.env.NODE_ENV === 'development') {
      const dataSize = JSON.stringify(data).length;
      logger.debug(`Dashboard update size: ${(dataSize / 1024).toFixed(2)} KB`);
    }
  } catch (error) {
    logger.error(`Error emitting dashboard update: ${error.message}`);
  }
};

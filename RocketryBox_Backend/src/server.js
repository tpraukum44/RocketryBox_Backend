/**
 * This file exports the Socket.IO instance for use across the application.
 * It's a simple proxy to avoid circular dependencies between modules.
 */

import { logger } from './utils/logger.js';
import { getIO } from './utils/socketio.js';

// Export a function that gets the io instance when needed (lazy loading)
export const getSocketIO = () => {
  try {
    return getIO();
  } catch (error) {
    logger.warn(`Error getting Socket.IO instance: ${error.message}`);
    // Provide fallback mock implementation
    return {
      to: () => ({ emit: () => { } }),
      emit: () => { },
      on: () => { }
    };
  }
};

// Create a lazy-loaded io object that gets the instance when accessed
const ioProxy = {};
Object.defineProperty(ioProxy, 'to', {
  get() { return getSocketIO().to; }
});
Object.defineProperty(ioProxy, 'emit', {
  get() { return getSocketIO().emit; }
});
Object.defineProperty(ioProxy, 'on', {
  get() { return getSocketIO().on; }
});

// Export the lazy io instance for backward compatibility
export const io = ioProxy;

// Export other server-related utilities as needed
export default {
  getSocketIO,
  get io() {
    return getSocketIO();
  }
};

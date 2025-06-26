import path from 'path';
import { fileURLToPath } from 'url';
import winston from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger instance - MINIMAL LOGGING ONLY
const logger = winston.createLogger({
  level: 'error', // Only log errors, no info/debug/warn
  format: logFormat,
  defaultMeta: { service: 'rocketrybox-backend' },
  transports: [
    // DISABLED: Console logging for clean terminal
    // new winston.transports.Console({
    //   format: winston.format.combine(
    //     winston.format.colorize(),
    //     winston.format.simple()
    //   )
    // }),
    // Write only errors to error.log
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
    // DISABLED: Combined log file
    // new winston.transports.File({
    //   filename: path.join(__dirname, '../../logs/combined.log'),
    //   maxsize: 5242880, // 5MB
    //   maxFiles: 5
    // })
  ]
});

// Create a stream object for Morgan
export const stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

export { logger };

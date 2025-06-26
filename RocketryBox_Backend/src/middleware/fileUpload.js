import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { logger } from '../utils/logger.js';
import { AppError } from './errorHandler.js';

// Set up storage destination for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/temp';

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// File filter for validating file types
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`File type ${file.mimetype} not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`, 400), false);
  }
};

// Create multer upload instance with size and file count limits
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 10 // Maximum 10 files per request
  }
});

// Error handler for multer errors
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('File too large. Maximum size is 10MB', 400));
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      return next(new AppError('Too many files. Maximum allowed is 10 files', 400));
    } else {
      return next(new AppError(`File upload error: ${err.message}`, 400));
    }
  }

  next(err);
};

// Clean up temporary files after request
export const cleanupTempFiles = (req, res, next) => {
  const originalEnd = res.end;

  res.end = function () {
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, err => {
          if (err) logger.error(`Error deleting temporary file: ${err.message}`);
        });
      });
    }

    originalEnd.apply(this, arguments);
  };

  next();
};

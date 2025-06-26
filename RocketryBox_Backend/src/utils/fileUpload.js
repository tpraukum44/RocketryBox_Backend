import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { s3Client } from '../config/aws.js';
import { logger } from './logger.js';

/**
 * Upload file to S3 bucket
 * @param {Object} file - Express multer file object
 * @param {String} key - S3 object key path
 * @returns {Promise<String>} - URL of the uploaded file
 */
export const uploadToS3 = async (file, key) => {
  try {
    // Hardcoded S3 bucket name
    const bucketName = 'rocketrybox';

    if (
      !process.env.AWS_ACCESS_KEY_ID ||
      !process.env.AWS_SECRET_ACCESS_KEY
    ) {
      logger.warn('AWS credentials not configured, saving file locally', {
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        bucketName: bucketName
      });
      return saveLocally(file);
    }

    // Generate unique key if not provided
    const objectKey = key || `uploads/${Date.now()}-${file.originalname}`;

    logger.info('Attempting S3 upload', {
      bucket: bucketName,
      region: process.env.AWS_REGION || 'ap-south-1',
      key: objectKey
    });

    // Create params for S3 upload
    const params = {
      Bucket: bucketName,
      Key: objectKey,
      Body: fs.createReadStream(file.path),
      ContentType: file.mimetype
    };

    // Upload to S3
    const command = new PutObjectCommand(params);
    const result = await s3Client.send(command);

    // Clean up local file after upload
    fs.unlink(file.path, (err) => {
      if (err) logger.error(`Error deleting temporary file: ${err.message}`);
    });

    // Construct the URL (CDN URL removed as it's not used)
    return `https://${bucketName}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${objectKey}`;
  } catch (error) {
    logger.error(`S3 upload error: ${error.message}`);
    logger.error(`S3 upload error details:`, {
      code: error.code,
      statusCode: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId
    });
    // Fallback to local storage
    return saveLocally(file);
  }
};

/**
 * Save file locally when S3 upload fails
 * @param {Object} file - Express multer file object
 * @returns {Promise<String>} - URL path of the saved file
 */
const saveLocally = async (file) => {
  try {
    // If file is already saved by multer, just return the path
    if (file.path) {
      // Convert backslashes to forward slashes for URL paths
      const relativePath = file.path.replace(/\\/g, '/');
      return `/${relativePath}`;
    }

    // If we need to manually save the file
    const uploadDir = 'uploads';

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(uploadDir, fileName);

    // Create a readable stream from the buffer and pipe to writable file stream
    const readStream = fs.createReadStream(file.path);
    const writeStream = fs.createWriteStream(filePath);

    readStream.pipe(writeStream);

    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        resolve(`/${filePath.replace(/\\/g, '/')}`);
      });
      writeStream.on('error', reject);
    });
  } catch (error) {
    logger.error(`Local file save error: ${error.message}`);
    throw new Error('Failed to save file locally');
  }
};

/**
 * Delete file from S3 bucket
 * @param {String} fileUrl - URL of the file to delete
 * @returns {Promise<Boolean>} - Success status
 */
export const deleteFromS3 = async (fileUrl) => {
  try {
    // Hardcoded S3 bucket name
    const bucketName = 'rocketrybox';

    // Extract key from URL
    let key;
    const s3BucketUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/`;

    if (fileUrl.startsWith(s3BucketUrl)) {
      key = fileUrl.substring(s3BucketUrl.length);
    } else {
      // Handle local file
      if (fileUrl.startsWith('/uploads/')) {
        deleteLocally(fileUrl.substring(1)); // Remove leading slash
        return true;
      }
      throw new Error('Invalid file URL');
    }

    // Check if AWS credentials are configured
    if (
      !process.env.AWS_ACCESS_KEY_ID ||
      !process.env.AWS_SECRET_ACCESS_KEY
    ) {
      logger.warn('AWS credentials not configured, deleting local file');
      deleteLocally(key);
      return true;
    }

    // Delete from S3
    const params = {
      Bucket: bucketName,
      Key: key
    };

    const command = new DeleteObjectCommand(params);
    await s3Client.send(command);

    logger.info(`File deleted from S3: ${key}`);
    return true;
  } catch (error) {
    logger.error(`S3 delete error: ${error.message}`);
    return false;
  }
};

/**
 * Delete file from local storage
 * @param {String} filePath - Path of the file to delete
 */
const deleteLocally = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`File deleted locally: ${filePath}`);
    }
  } catch (error) {
    logger.error(`Local file delete error: ${error.message}`);
  }
};

/**
 * Upload file to storage (S3 or local)
 * @param {Object} file - Express multer file object
 * @param {String} folder - Folder to store the file in (optional)
 * @returns {Promise<String>} - URL of the uploaded file
 */
export const uploadFile = async (file, folder = 'uploads') => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    // Generate a key with folder structure
    const fileName = `${Date.now()}-${file.originalname}`;
    const key = `${folder}/${fileName}`;

    // Upload to S3 or local storage
    return await uploadToS3(file, key);
  } catch (error) {
    logger.error(`File upload error: ${error.message}`);
    throw error;
  }
};

/**
 * Generate signed URL for S3 object
 * @param {String} fileUrl - S3 URL of the file
 * @param {Number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<String>} - Signed URL for secure access
 */
export const generateSignedUrl = async (fileUrl, expiresIn = 3600) => {
  try {
    if (!fileUrl) {
      return null;
    }

    // Check if it's a local file (starts with /)
    if (fileUrl.startsWith('/')) {
      // For local files, return the URL as-is since they're served directly
      return fileUrl;
    }

    // Hardcoded S3 bucket name
    const bucketName = 'rocketrybox';

    // Extract key from S3 URL
    let key;
    const s3BucketUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/`;

    if (fileUrl.startsWith(s3BucketUrl)) {
      key = fileUrl.substring(s3BucketUrl.length);
    } else {
      // If it's already a signed URL or different format, return as-is
      return fileUrl;
    }

    // Check if AWS credentials are configured
    if (
      !process.env.AWS_ACCESS_KEY_ID ||
      !process.env.AWS_SECRET_ACCESS_KEY
    ) {
      logger.warn('AWS credentials not configured, returning original URL');
      return fileUrl;
    }

    // Create GetObject command for signed URL
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    });

    // Generate signed URL
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });

    logger.info(`Generated signed URL for key: ${key}`, {
      expiresIn,
      keyLength: key.length
    });

    return signedUrl;
  } catch (error) {
    logger.error(`Error generating signed URL: ${error.message}`, {
      fileUrl,
      error: error.code
    });
    // Fallback to original URL
    return fileUrl;
  }
};

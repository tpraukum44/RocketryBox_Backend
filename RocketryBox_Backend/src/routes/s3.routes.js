// S3 Routes - Signed URL Generation for Private Bucket Uploads
// This handles secure file uploads to S3 without exposing AWS credentials

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AWS_CONFIG, s3Client } from '../config/aws.js';

const router = express.Router();

/**
 * Generate signed URL for profile photo upload
 *
 * Route: GET /s3/upload-url
 * Query Parameters:
 *   - userId: User ID (required)
 *   - fileType: MIME type of the file (optional, defaults to image/jpeg)
 *
 * Returns a signed URL that allows direct upload to S3
 * The URL expires after 1 hour for security
 */
router.get('/upload-url', async (req, res) => {
  try {
    const { userId, fileType = 'image/jpeg' } = req.query;

    // Validate required parameters
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    // Validate file type
    if (!AWS_CONFIG.allowedFileTypes.includes(fileType)) {
      return res.status(400).json({
        success: false,
        error: `File type ${fileType} not allowed. Allowed types: ${AWS_CONFIG.allowedFileTypes.join(', ')}`
      });
    }

    // Generate unique file name
    const fileExtension = fileType.split('/')[1]; // e.g., 'jpeg' from 'image/jpeg'
    const fileName = `${userId}-${uuidv4()}.${fileExtension}`;
    const filePath = `${AWS_CONFIG.profilePhotoPath}/${fileName}`;

    // Create S3 PutObject command for signed URL
    const putObjectCommand = new PutObjectCommand({
      Bucket: AWS_CONFIG.s3BucketName,
      Key: filePath,
      ContentType: fileType,
      // Important: These metadata help with security and organization
      Metadata: {
        'uploaded-by': userId,
        'upload-timestamp': new Date().toISOString(),
        'file-type': 'profile-photo'
      },
      // Server-side encryption (optional but recommended)
      ServerSideEncryption: 'AES256'
    });

    // Generate signed URL for upload (PUT operation)
    const uploadUrl = await getSignedUrl(s3Client, putObjectCommand, {
      expiresIn: AWS_CONFIG.s3SignedUrlExpiry // 1 hour
    });

    // Also generate a signed URL for downloading the file after upload
    const getObjectCommand = new GetObjectCommand({
      Bucket: AWS_CONFIG.s3BucketName,
      Key: filePath
    });

    const downloadUrl = await getSignedUrl(s3Client, getObjectCommand, {
      expiresIn: AWS_CONFIG.s3SignedUrlExpiry // 1 hour
    });

    res.json({
      success: true,
      data: {
        uploadUrl,
        downloadUrl,
        fileName,
        filePath,
        expiresIn: AWS_CONFIG.s3SignedUrlExpiry,
        expiresAt: new Date(Date.now() + AWS_CONFIG.s3SignedUrlExpiry * 1000).toISOString(),
        // Instructions for frontend
        uploadInstructions: {
          method: 'PUT',
          headers: {
            'Content-Type': fileType
          },
          maxFileSize: AWS_CONFIG.maxFileSize,
          note: 'Upload the file using PUT request to the uploadUrl. No additional headers needed.'
        }
      }
    });

  } catch (error) {
    console.error('Error generating S3 signed URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate upload URL',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Generate signed URL for downloading/viewing a file
 *
 * Route: GET /s3/download-url/:filePath
 * Parameters:
 *   - filePath: Path to the file in S3 (URL encoded)
 *
 * Returns a signed URL for accessing the private file
 */
router.get('/download-url/:filePath(*)', async (req, res) => {
  try {
    const { filePath } = req.params;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'filePath is required'
      });
    }

    // Create S3 GetObject command for signed URL
    const getObjectCommand = new GetObjectCommand({
      Bucket: AWS_CONFIG.s3BucketName,
      Key: filePath
    });

    // Generate signed URL for download (GET operation)
    const downloadUrl = await getSignedUrl(s3Client, getObjectCommand, {
      expiresIn: AWS_CONFIG.s3SignedUrlExpiry // 1 hour
    });

    res.json({
      success: true,
      data: {
        downloadUrl,
        filePath,
        expiresIn: AWS_CONFIG.s3SignedUrlExpiry,
        expiresAt: new Date(Date.now() + AWS_CONFIG.s3SignedUrlExpiry * 1000).toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating S3 download URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate download URL',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * IMPORTANT NOTES FOR FRONTEND DEVELOPERS:
 *
 * 1. Using the Upload URL:
 *    - Make a PUT request to the uploadUrl
 *    - Set Content-Type header to match the fileType
 *    - Send the file as the request body (not form-data)
 *    - Example with fetch:
 *      ```javascript
 *      const response = await fetch(uploadUrl, {
 *        method: 'PUT',
 *        headers: { 'Content-Type': fileType },
 *        body: fileBlob
 *      });
 *      ```
 *
 * 2. Private Bucket Security:
 *    - The S3 bucket has "Block all public access" enabled
 *    - Files can ONLY be accessed through signed URLs
 *    - Signed URLs expire after 1 hour for security
 *    - Generate new download URLs when needed
 *
 * 3. File Organization:
 *    - Files are stored in: profile-photos/userId-uuid.extension
 *    - Each file has metadata for tracking and security
 *
 * 4. Error Handling:
 *    - Always check the response status
 *    - Handle expired URLs gracefully
 *    - Validate file types and sizes on frontend too
 */

export default router;

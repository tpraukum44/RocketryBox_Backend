// AWS SDK Configuration for both Local Development and EC2 Deployment
// Supports both AWS access keys (local dev) and IAM roles (EC2)

import { S3Client } from '@aws-sdk/client-s3';
import { SESClient } from '@aws-sdk/client-ses';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Hardcoded configuration values
const S3_BUCKET_NAME = 'rocketrybox';
const SES_FROM_EMAIL = 'admin@rocketrybox.com';

// Validate required environment variables (only AWS_REGION)
const requiredEnvVars = {
  AWS_REGION: process.env.AWS_REGION
};

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

/**
 * AWS Credentials Configuration
 *
 * For Local Development: Uses AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
 * For EC2 Deployment: Uses IAM role credentials automatically
 */
const getAwsCredentials = () => {
  const hasAccessKeys = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

  if (hasAccessKeys) {
    // Local development with access keys
    return {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  } else {
    // EC2 deployment with IAM role - return undefined to use default credential chain
    return undefined;
  }
};

const credentials = getAwsCredentials();
const isUsingAccessKeys = !!credentials;

/**
 * AWS S3 Client Configuration
 *
 * Local Development: Uses explicit AWS access keys
 * EC2 Production: Uses IAM role credentials automatically
 */
export const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: credentials, // undefined for IAM role, object for access keys
});

/**
 * AWS SES Client Configuration
 *
 * Same credential strategy as S3
 */
export const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: credentials, // undefined for IAM role, object for access keys
});

/**
 * AWS Configuration Constants
 */
export const AWS_CONFIG = {
  region: process.env.AWS_REGION,
  s3BucketName: S3_BUCKET_NAME,
  sesSenderEmail: SES_FROM_EMAIL,

  // S3 Configuration for signed URLs
  s3SignedUrlExpiry: 3600, // 1 hour in seconds

  // Profile photo upload configuration
  profilePhotoPath: 'profile-photos', // Path within S3 bucket
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxFileSize: 5 * 1024 * 1024, // 5MB
};

/**
 * How EC2 IAM Roles Work:
 *
 * 1. When you attach an IAM role to an EC2 instance, AWS automatically:
 *    - Makes temporary credentials available via the Instance Metadata Service
 *    - Rotates these credentials automatically before they expire
 *    - Provides access only to the permissions defined in the IAM role
 *
 * 2. The AWS SDK automatically:
 *    - Discovers the IAM role credentials from the metadata service
 *    - Uses these credentials for all AWS API calls
 *    - Refreshes credentials automatically when they near expiration
 *
 * 3. Benefits:
 *    - No hardcoded AWS keys in your code
 *    - No need to manage credential rotation
 *    - Follows AWS security best practices
 *    - Easier to manage permissions via IAM roles
 *
 * 4. Required IAM Role Permissions:
 *    - S3: s3:GetObject, s3:PutObject, s3:DeleteObject on your bucket
 *    - SES: ses:SendEmail, ses:SendRawEmail
 */

// DISABLED: AWS configuration console logs
// console.log('✅ AWS configuration initialized');
// console.log(`📍 Region: ${process.env.AWS_REGION}`);
// console.log(`🪣 S3 Bucket: ${S3_BUCKET_NAME}`);
// console.log(`📧 SES Sender: ${SES_FROM_EMAIL}`);

// if (isUsingAccessKeys) {
//   console.log('🔑 Using AWS Access Keys for local development');
//   console.log(`🔐 Access Key ID: ${process.env.AWS_ACCESS_KEY_ID.substring(0, 8)}...`);
// } else {
//   console.log('🔐 Using EC2 IAM role credentials (no AWS keys needed)');
// }

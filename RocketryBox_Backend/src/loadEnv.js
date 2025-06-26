import { GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm';

/**
 * Helper function to get all parameters by path with pagination support
 * AWS SSM Parameter Store limits MaxResults to 10 per call
 * @param {SSMClient} ssmClient - Initialized SSM client
 * @param {string} parameterPath - The parameter path to fetch
 * @returns {Promise<Array>} - Array of all parameters
 */
const getAllParametersByPath = async (ssmClient, parameterPath) => {
  const allParameters = [];
  let nextToken = null;
  let requestCount = 0;
  const maxRequests = 20; // Safety limit to prevent infinite loops

  do {
    requestCount++;
    
    // Safety check to prevent infinite loops
    if (requestCount > maxRequests) {
      console.warn(`⚠️  Reached maximum request limit (${maxRequests}). Some parameters may not be loaded.`);
      break;
    }

    const command = new GetParametersByPathCommand({
      Path: parameterPath,
      Recursive: true,
      WithDecryption: true, // Automatically decrypt SecureString parameters
      MaxResults: 10, // AWS SSM Parameter Store maximum allowed value
      NextToken: nextToken // Include token for pagination
    });

    try {
      const response = await ssmClient.send(command);
      
      // Add parameters from this batch to our collection
      if (response.Parameters && response.Parameters.length > 0) {
        allParameters.push(...response.Parameters);
        console.log(`📄 Batch ${requestCount}: Loaded ${response.Parameters.length} parameters`);
      }

      // Update nextToken for the next iteration
      nextToken = response.NextToken;
      
    } catch (error) {
      console.error(`❌ Error in batch ${requestCount}:`, error.message);
      throw error; // Re-throw to be handled by the main function
    }
    
  } while (nextToken); // Continue while there are more pages

  console.log(`📊 Total parameters fetched: ${allParameters.length} (${requestCount} API calls)`);
  return allParameters;
};

/**
 * Load environment variables from AWS SSM Parameter Store
 * Parameters are expected to be stored under /Rocketry_Box02/backend/
 * in the ap-south-1 region
 */
export const loadEnvironmentFromSSM = async () => {
  // Skip SSM loading in development or if explicitly disabled
  if (process.env.NODE_ENV !== 'production' && process.env.FORCE_SSM !== 'true') {
    console.log('🔧 Skipping SSM Parameter Store loading (development mode)');
    return;
  }

  console.log('🔄 Loading environment variables from AWS SSM Parameter Store...');

  try {
    // Initialize SSM client for ap-south-1 region
    const ssmClient = new SSMClient({
      region: 'ap-south-1',
      // AWS credentials will be automatically loaded from:
      // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
      // 2. IAM role (if running on EC2/ECS/Lambda)
      // 3. AWS credentials file
      // 4. AWS SSO
    });

    const parameterPath = '/Rocketry_Box02/backend/';
    
    console.log(`📡 Fetching parameters from path: ${parameterPath}`);

    // Collect all parameters using pagination
    const allParameters = await getAllParametersByPath(ssmClient, parameterPath);

    if (!allParameters || allParameters.length === 0) {
      console.warn('⚠️  No parameters found in SSM Parameter Store');
      return;
    }

    let loadedCount = 0;
    const loadedParams = [];

    // Process each parameter
    for (const parameter of allParameters) {
      if (parameter.Name && parameter.Value) {
        // Extract the final segment of the parameter name as the environment variable key
        // Example: /Rocketry_Box02/backend/MONGO_URI -> MONGO_URI
        const envKey = parameter.Name.split('/').pop();

        if (envKey) {
          // Set the environment variable
          process.env[envKey] = parameter.Value;
          loadedParams.push(envKey);
          loadedCount++;
        }
      }
    }

    console.log(`✅ Successfully loaded ${loadedCount} environment variables from SSM:`);
    console.log(`   📋 Parameters: ${loadedParams.join(', ')}`);

    // Log total parameters fetched if more than 10 (indicating pagination was used)
    if (allParameters.length > 10) {
      console.log(`📄 Fetched ${allParameters.length} parameters using pagination`);
    }

  } catch (error) {
    console.error('❌ Failed to load environment variables from SSM Parameter Store:');
    console.error(`   Error: ${error.message}`);

    // Log additional details for common errors
    if (error.name === 'AccessDeniedException') {
      console.error('   💡 Check that your AWS role has ssm:GetParametersByPath permissions');
    } else if (error.name === 'CredentialsError' || error.name === 'UnauthorizedOperation') {
      console.error('   💡 Check your AWS credentials configuration');
    } else if (error.name === 'NetworkingError') {
      console.error('   💡 Check your network connectivity to AWS');
    }

    // In production, you might want to exit the process if SSM loading fails
    if (process.env.NODE_ENV === 'production' && process.env.SSM_REQUIRED !== 'false') {
      console.error('🚨 SSM Parameter loading is required in production. Exiting...');
      process.exit(1);
    } else {
      console.warn('⚠️  Continuing without SSM parameters (development mode or SSM_REQUIRED=false)');
    }
  }
};

/**
 * Alternative implementation using AWS SDK v2 (if preferred)
 * Uncomment this if you prefer to use AWS SDK v2
 * Note: This also needs pagination support for >10 parameters
 */
/*
import AWS from 'aws-sdk';

// Helper function for AWS SDK v2 pagination
const getAllParametersV2 = async (ssm, parameterPath) => {
  const allParameters = [];
  let nextToken = null;
  let requestCount = 0;
  const maxRequests = 20;

  do {
    requestCount++;
    
    if (requestCount > maxRequests) {
      console.warn(`⚠️  Reached maximum request limit (${maxRequests}). Some parameters may not be loaded.`);
      break;
    }

    const params = {
      Path: parameterPath,
      Recursive: true,
      WithDecryption: true,
      MaxResults: 10, // AWS SSM maximum allowed value
      NextToken: nextToken
    };

    try {
      const result = await ssm.getParametersByPath(params).promise();
      
      if (result.Parameters && result.Parameters.length > 0) {
        allParameters.push(...result.Parameters);
        console.log(`📄 Batch ${requestCount}: Loaded ${result.Parameters.length} parameters`);
      }

      nextToken = result.NextToken;
      
    } catch (error) {
      console.error(`❌ Error in batch ${requestCount}:`, error.message);
      throw error;
    }
    
  } while (nextToken);

  console.log(`📊 Total parameters fetched: ${allParameters.length} (${requestCount} API calls)`);
  return allParameters;
};

export const loadEnvironmentFromSSMV2 = async () => {
  if (process.env.NODE_ENV !== 'production' && process.env.FORCE_SSM !== 'true') {
    console.log('🔧 Skipping SSM Parameter Store loading (development mode)');
    return;
  }

  console.log('🔄 Loading environment variables from AWS SSM Parameter Store...');

  try {
    const ssm = new AWS.SSM({ region: 'ap-south-1' });
    const parameterPath = '/Rocketry_Box02/backend/';

    console.log(`📡 Fetching parameters from path: ${parameterPath}`);

    // Use pagination helper to get all parameters
    const allParameters = await getAllParametersV2(ssm, parameterPath);

    if (!allParameters || allParameters.length === 0) {
      console.warn('⚠️  No parameters found in SSM Parameter Store');
      return;
    }

    let loadedCount = 0;
    const loadedParams = [];

    for (const parameter of allParameters) {
      if (parameter.Name && parameter.Value) {
        const envKey = parameter.Name.split('/').pop();
        if (envKey) {
          process.env[envKey] = parameter.Value;
          loadedParams.push(envKey);
          loadedCount++;
        }
      }
    }

    console.log(`✅ Successfully loaded ${loadedCount} environment variables from SSM:`);
    console.log(`   📋 Parameters: ${loadedParams.join(', ')}`);

    // Log pagination usage
    if (allParameters.length > 10) {
      console.log(`📄 Fetched ${allParameters.length} parameters using pagination`);
    }

  } catch (error) {
    console.error('❌ Failed to load environment variables from SSM Parameter Store:');
    console.error(`   Error: ${error.message}`);

    if (process.env.NODE_ENV === 'production' && process.env.SSM_REQUIRED !== 'false') {
      console.error('🚨 SSM Parameter loading is required in production. Exiting...');
      process.exit(1);
    } else {
      console.warn('⚠️  Continuing without SSM parameters (development mode or SSM_REQUIRED=false)');
    }
  }
};
*/

export default loadEnvironmentFromSSM;

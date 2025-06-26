import axios from 'axios';
import { BLUEDART_CONFIG } from '../config/bluedart.config.js';

/**
 * BlueDart Service with Official YAML Specification Compliance
 * Updated for PickupRegistrationService.yaml compatibility
 */
export class BlueDartService {
  constructor(config = BLUEDART_CONFIG) {
    this.config = config;
    this.tokenCache = null;
    this.tokenExpiry = null;
  }

  /**
   * Generate JWT token for authentication
   * Works with both production and sandbox environments
   */
  async getJWTToken() {
    try {
      // Check if cached token is still valid
      if (this.tokenCache && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.tokenCache;
      }

      console.log('🔑 Generating JWT token...');
      
      const response = await axios.get(this.config.ENDPOINTS.AUTHENTICATION, {
        headers: {
          'ClientID': this.config.CONSUMER_KEY,
          'clientSecret': this.config.CONSUMER_SECRET,
          'Accept': 'application/json'
        },
        timeout: this.config.REQUEST_TIMEOUT
      });

      if (response.data?.JWTToken) {
        this.tokenCache = response.data.JWTToken;
        this.tokenExpiry = Date.now() + (this.config.TOKEN_EXPIRY * 0.9); // Use 90% of expiry time
        
        console.log(`✅ JWT token generated successfully (${this.tokenCache.length} characters)`);
        return this.tokenCache;
      } else {
        throw new Error('JWT token not found in response');
      }
    } catch (error) {
      console.log('❌ JWT token generation failed:', error.message);
      this.tokenCache = null;
      this.tokenExpiry = null;
      throw error;
    }
  }

  /**
   * Make authenticated request with JWT token
   */
  async makeAuthenticatedRequest(url, payload, token, method = 'POST') {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'JWTToken': token,
      'ClientID': this.config.CONSUMER_KEY,
      'clientSecret': this.config.CONSUMER_SECRET,
      'User-Agent': 'RocketryBox-BlueDart-Integration/1.0'
    };

    const config = {
      method,
      url,
      headers,
      timeout: this.config.REQUEST_TIMEOUT
    };

    if (method !== 'GET' && payload) {
      config.data = payload;
    }

    const response = await axios(config);
    return response.data;
  }

  /**
   * Register pickup using official YAML specification format
   * Updated to match PickupRegistrationService.yaml exactly
   */
  async registerPickup(pickupData) {
    const startTime = Date.now();
    
    try {
      // Get JWT token for authentication
      const token = await this.getJWTToken();
      
      if (!token) {
        throw new Error('Failed to generate JWT token for pickup registration');
      }

      console.log('🚀 Registering pickup with BlueDart using official YAML specification...');

      // Validate required fields according to YAML spec
      const requiredFields = [
        'AreaCode', 'CustomerCode', 'CustomerName', 'CustomerPincode', 
        'OfficeCloseTime', 'ProductCode', 'ShipmentPickupDate', 'ShipmentPickupTime'
      ];
      
      for (const field of requiredFields) {
        if (!pickupData[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Official YAML specification payload format
      const officialPayload = {
        "request": {
          "AWBNo": pickupData.AWBNo || [""],  // Array format - can be empty
          "AreaCode": pickupData.AreaCode,  // REQUIRED - 3 chars, A-Z
          "CISDDN": pickupData.CISDDN || false,
          "ContactPersonName": pickupData.ContactPersonName || pickupData.CustomerName,  // Max 30 chars
          "CustomerAddress1": pickupData.CustomerAddress1,  // Max 30 chars
          "CustomerAddress2": pickupData.CustomerAddress2 || "",  // Max 30 chars
          "CustomerAddress3": pickupData.CustomerAddress3 || "",  // Max 30 chars
          "CustomerCode": pickupData.CustomerCode,  // REQUIRED - Max 6 chars, A-Z,0-9
          "CustomerName": pickupData.CustomerName,  // REQUIRED - Max 30 chars
          "CustomerPincode": pickupData.CustomerPincode,  // REQUIRED - Max 6 chars, 0-9
          "CustomerTelephoneNumber": pickupData.CustomerTelephoneNumber || "",  // Min 6, Max 15 chars, 0-9
          "DoxNDox": pickupData.DoxNDox || "1",  // REQUIRED - Enum: "1" or "2"
          "EmailID": pickupData.EmailID || "",  // Max 30 chars
          "IsForcePickup": pickupData.IsForcePickup || false,  // Boolean
          "IsReversePickup": pickupData.IsReversePickup || false,  // Boolean
          "MobileTelNo": pickupData.MobileTelNo || pickupData.CustomerTelephoneNumber || "",  // Min 6, Max 15 chars, 0-9
          "NumberofPieces": parseInt(pickupData.NumberofPieces) || 1,  // Number type - Max 4 digits
          "OfficeCloseTime": pickupData.OfficeCloseTime,  // REQUIRED - Max 5 chars, 0-9 (HHmm format)
          "PackType": pickupData.PackType || "",  // Max 1 char, A-Z
          "ProductCode": pickupData.ProductCode,  // REQUIRED - Max 1 char, A-Z
          "ReferenceNo": pickupData.ReferenceNo || "",  // String
          "Remarks": pickupData.Remarks || "",  // Max 60 chars
          "RouteCode": pickupData.RouteCode || "",  // Max 2 chars, A-Z,0-9
          "ShipmentPickupDate": pickupData.ShipmentPickupDate,  // REQUIRED - BlueDart date format
          "ShipmentPickupTime": pickupData.ShipmentPickupTime,  // REQUIRED - Max 5 chars, 0-9 (HHmm format)
          "SubProducts": pickupData.SubProducts || [""],  // Array of strings
          "VolumeWeight": parseFloat(pickupData.VolumeWeight) || 0.5,  // Number, Max 8.2
          "WeightofShipment": parseFloat(pickupData.WeightofShipment) || 0.5,  // Number, Max 8.2
          "isToPayShipper": pickupData.isToPayShipper || false  // Boolean
        },
        "profile": {
          "Api_type": this.config.API_TYPE,  // REQUIRED - Enum: "T" or "S"
          "LicenceKey": this.config.LICENSE_KEY,  // REQUIRED - Max 2000 chars
          "LoginID": this.config.USER  // REQUIRED - Max 30 chars, A-z,0-9
        }
      };

      console.log('📊 Official YAML Payload Details:');
      console.log(`   🔤 AreaCode: ${officialPayload.request.AreaCode}`);
      console.log(`   👤 CustomerCode: ${officialPayload.request.CustomerCode}`);
      console.log(`   📝 CustomerName: ${officialPayload.request.CustomerName}`);
      console.log(`   📍 CustomerPincode: ${officialPayload.request.CustomerPincode}`);
      console.log(`   🕐 OfficeCloseTime: ${officialPayload.request.OfficeCloseTime}`);
      console.log(`   📦 ProductCode: ${officialPayload.request.ProductCode}`);
      console.log(`   📅 ShipmentPickupDate: ${officialPayload.request.ShipmentPickupDate}`);
      console.log(`   ⏰ ShipmentPickupTime: ${officialPayload.request.ShipmentPickupTime}`);

      // Make request to RegisterPickup endpoint
      const response = await this.makeAuthenticatedRequest(
        this.config.ENDPOINTS.PRODUCT_PICKUP_DETAIL,
        officialPayload,
        token,
        'POST'
      );

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`✅ Pickup registration request completed in ${responseTime}ms`);

      // Process response according to YAML specification
      if (response.RegisterPickupResult) {
        const result = response.RegisterPickupResult;
        
        if (!result.IsError) {
          console.log('🎉 Pickup registered successfully!');
          return {
            success: true,
            pickupRequestNumber: result.PickupRequestNumber,
            tokenNumber: result.TokenNumber,
            data: result,
            responseTime: responseTime
          };
        } else {
          console.log('⚠️ Pickup registration returned error from BlueDart');
          if (result.Status && result.Status.length > 0) {
            const status = result.Status[0];
            throw new Error(`BlueDart Error ${status.StatusCode}: ${status.StatusInformation}`);
          } else {
            throw new Error('Unknown error from BlueDart pickup registration');
          }
        }
      }

      // Return response even if structure is different (for debugging)
      return {
        success: true,
        data: response,
        responseTime: responseTime,
        note: 'Response structure differs from expected format'
      };

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Enhanced error handling for common scenarios
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;

        if (status === 400) {
          // Check if it's RequestAuthenticationFailed (account activation needed)
          if (errorData?.['error-response']?.some(err => 
            err.StatusCode === 'RequestAuthenticationFailed' || 
            err.StatusInformation?.includes('authentication failed')
          )) {
            console.log('💡 Account activation required for pickup registration');
            return {
              success: false,
              error: 'ACCOUNT_ACTIVATION_REQUIRED',
              message: 'BlueDart account needs activation for pickup registration API. Contact BlueDart support.',
              details: errorData,
              responseTime: responseTime,
              technicalStatus: 'Implementation complete - awaiting account activation'
            };
          }

          // Other validation errors
          console.log('⚠️ Pickup registration validation error:', errorData);
          return {
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Request validation failed. Please check pickup data.',
            details: errorData,
            responseTime: responseTime
          };
        }

        if (status === 401) {
          console.log('🔑 JWT token authentication failed');
          return {
            success: false,
            error: 'AUTHENTICATION_ERROR',
            message: 'JWT token authentication failed',
            responseTime: responseTime
          };
        }

        if (status === 415) {
          console.log('❌ Media type still not supported - this should not happen with YAML spec');
          return {
            success: false,
            error: 'MEDIA_TYPE_ERROR',
            message: 'Unsupported media type - API specification mismatch',
            responseTime: responseTime
          };
        }

        console.log(`❌ Pickup registration failed with status ${status}:`, errorData);
        return {
          success: false,
          error: 'HTTP_ERROR',
          message: `Request failed with status ${status}`,
          details: errorData,
          responseTime: responseTime
        };
      }

      console.log('❌ Pickup registration failed:', error.message);
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: error.message,
        responseTime: responseTime
      };
    }
  }

  /**
   * Track shipment using AWB number
   */
  async trackShipment(awbNumber) {
    const startTime = Date.now();
    
    try {
      const token = await this.getJWTToken();
      
      if (!token) {
        throw new Error('Failed to generate JWT token for tracking');
      }

      console.log(`🔍 Tracking shipment: ${awbNumber}`);

      const trackingUrl = `${this.config.ENDPOINTS.TRACKING}?awb=${awbNumber}&loginid=${this.config.USER}&lickey=${this.config.LICENSE_KEY}&mode=xml`;

      const response = await this.makeAuthenticatedRequest(
        trackingUrl,
        null,
        token,
        'GET'
      );

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`✅ Tracking request completed in ${responseTime}ms`);

      return {
        success: true,
        awbNumber: awbNumber,
        trackingData: response,
        responseTime: responseTime
      };

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`❌ Tracking failed for AWB ${awbNumber}:`, error.message);
      return {
        success: false,
        awbNumber: awbNumber,
        error: error.message,
        responseTime: responseTime
      };
    }
  }

  /**
   * Get transit time between pin codes
   */
  async getTransitTime(originPincode, destinationPincode, productCode = 'A') {
    const startTime = Date.now();
    
    try {
      const token = await this.getJWTToken();
      
      if (!token) {
        throw new Error('Failed to generate JWT token for transit time');
      }

      console.log(`🚚 Getting transit time: ${originPincode} → ${destinationPincode}`);

      const payload = {
        "request": {
          "OriginPincode": originPincode,
          "DestinationPincode": destinationPincode,
          "ProductCode": productCode
        },
        "profile": {
          "LoginID": this.config.USER,
          "LicenceKey": this.config.LICENSE_KEY,
          "Api_type": this.config.API_TYPE
        }
      };

      const response = await this.makeAuthenticatedRequest(
        this.config.ENDPOINTS.TRANSIT_TIME,
        payload,
        token,
        'POST'
      );

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`✅ Transit time request completed in ${responseTime}ms`);

      return {
        success: true,
        originPincode,
        destinationPincode,
        productCode,
        transitData: response,
        responseTime: responseTime
      };

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`❌ Transit time failed: ${error.message}`);
      return {
        success: false,
        originPincode,
        destinationPincode,
        productCode,
        error: error.message,
        responseTime: responseTime
      };
    }
  }
}

// Create and export default instance
const blueDartService = new BlueDartService();
export default blueDartService; 
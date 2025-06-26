import Seller from '../modules/seller/models/seller.model.js';
import * as delhivery from '../utils/delhivery.js';
import { logger } from '../utils/logger.js';
import ekartService from './ekart.service.js';

/**
 * Service to handle automatic warehouse registration with shipping partners
 * This service is called whenever a seller creates a new warehouse
 */
class ShippingPartnerRegistrationService {

  /**
   * Register warehouse with all enabled shipping partners
   * @param {Object} warehouseData - Warehouse data from seller
   * @param {Object} sellerData - Seller information
   * @returns {Object} - Registration results
   */
  async registerWarehouseWithPartners(warehouseData, sellerData) {
    const registrationResults = {
      success: true,
      results: {},
      errors: [],
      summary: {
        totalPartners: 0,
        successfulRegistrations: 0,
        failedRegistrations: 0
      }
    };

    logger.info('Starting warehouse registration with shipping partners', {
      warehouse: warehouseData.name,
      seller: sellerData.businessName || sellerData.name,
      pincode: warehouseData.pincode
    });

    // Get enabled shipping partners (you can make this configurable per seller)
    const enabledPartners = await this.getEnabledPartners(sellerData);

    for (const partner of enabledPartners) {
      registrationResults.summary.totalPartners++;

      try {
        logger.info(`Registering warehouse with ${partner.name}`, {
          warehouse: warehouseData.name,
          partner: partner.name
        });

        let result;
        switch (partner.code) {
          case 'ekart':
            result = await this.registerWithEkart(warehouseData, sellerData);
            break;
          case 'bluedart':
            result = await this.registerWithBlueDart(warehouseData, sellerData);
            break;
          case 'delhivery':
            result = await this.registerWithDelhivery(warehouseData, sellerData);
            break;
          case 'dtdc':
            result = await this.registerWithDtdc(warehouseData, sellerData);
            break;
          default:
            result = { success: false, error: 'Unknown partner' };
        }

        registrationResults.results[partner.code] = result;

        if (result.success) {
          registrationResults.summary.successfulRegistrations++;
          logger.info(`Successfully registered with ${partner.name}`, {
            warehouse: warehouseData.name,
            partner: partner.name,
            alias: result.alias
          });
        } else {
          registrationResults.summary.failedRegistrations++;
          registrationResults.errors.push(`${partner.name}: ${result.error}`);
          logger.warn(`Failed to register with ${partner.name}`, {
            warehouse: warehouseData.name,
            partner: partner.name,
            error: result.error
          });
        }

      } catch (error) {
        registrationResults.summary.failedRegistrations++;
        registrationResults.errors.push(`${partner.name}: ${error.message}`);
        logger.error(`Exception registering with ${partner.name}`, {
          warehouse: warehouseData.name,
          partner: partner.name,
          error: error.message
        });
      }

      // Add delay between registrations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Determine overall success
    registrationResults.success = registrationResults.summary.successfulRegistrations > 0;

    logger.info('Warehouse registration completed', {
      warehouse: warehouseData.name,
      totalPartners: registrationResults.summary.totalPartners,
      successful: registrationResults.summary.successfulRegistrations,
      failed: registrationResults.summary.failedRegistrations
    });

    return registrationResults;
  }

  /**
   * Register warehouse with Ekart using the correct API
   * @param {Object} warehouseData - Warehouse data
   * @param {Object} sellerData - Seller data
   * @returns {Object} - Registration result
   */
  async registerWithEkart(warehouseData, sellerData) {
    try {
      // Prepare address data according to Ekart API specification
      const ekartAddressData = {
        alias: warehouseData.name,
        name: warehouseData.contactPerson || sellerData.businessName || 'Business Owner',
        phone: (warehouseData.phone || sellerData.phone || '9999999999').replace(/\D/g, ''),
        contactPhone: (warehouseData.phone || sellerData.phone || '9999999999').replace(/\D/g, ''),
        address: {
          line1: warehouseData.address,
          line2: warehouseData.landmark || '',
          city: warehouseData.city,
          state: warehouseData.state,
          pincode: warehouseData.pincode,
          country: warehouseData.country || 'India'
        },
        addressLine1: warehouseData.address,
        city: warehouseData.city,
        state: warehouseData.state,
        pincode: warehouseData.pincode
      };

      logger.info('Registering warehouse with Ekart', {
        warehouse: warehouseData.name,
        alias: ekartAddressData.alias,
        pincode: ekartAddressData.pincode,
        phone: ekartAddressData.phone
      });

      // Use the updated Ekart service with correct API endpoints
      const result = await ekartService.registerWarehouse(ekartAddressData);

      if (result.success) {
        logger.info('Successfully registered warehouse with Ekart', {
          warehouse: warehouseData.name,
          alias: result.alias,
          addressId: result.addressId
        });

        return {
          success: true,
          alias: result.alias,
          addressId: result.addressId,
          message: result.message || 'Successfully registered with Ekart',
          partner: 'Ekart',
          timestamp: result.timestamp
        };
      } else {
        // Check if it's already registered (common scenario)
        if (result.error && (
          result.error.toLowerCase().includes('already exists') ||
          result.error.toLowerCase().includes('duplicate') ||
          result.error.toLowerCase().includes('existing') ||
          result.error.toLowerCase().includes('same alias')
        )) {
          logger.info('Warehouse already registered with Ekart', {
            warehouse: warehouseData.name,
            alias: warehouseData.name
          });

          return {
            success: true,
            alias: warehouseData.name,
            message: 'Address already registered with Ekart',
            partner: 'Ekart',
            warning: 'Address was already registered with Ekart'
          };
        }

        logger.warn('Failed to register warehouse with Ekart', {
          warehouse: warehouseData.name,
          error: result.error
        });

        return {
          success: false,
          error: result.error || 'Unknown Ekart registration error',
          partner: 'Ekart'
        };
      }

    } catch (error) {
      logger.error('Exception registering warehouse with Ekart', {
        warehouse: warehouseData.name,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message,
        partner: 'Ekart'
      };
    }
  }

  /**
   * Register warehouse with BlueDart
   * @param {Object} warehouseData - Warehouse data
   * @param {Object} sellerData - Seller data
   * @returns {Object} - Registration result
   */
  async registerWithBlueDart(warehouseData, sellerData) {
    // BlueDart registration logic would go here
    // For now, return a placeholder
    return {
      success: false,
      error: 'BlueDart registration not implemented yet',
      partner: 'BlueDart'
    };
  }

  /**
   * Register warehouse with Delhivery
   * @param {Object} warehouseData - Warehouse data
   * @param {Object} sellerData - Seller data
   * @returns {Object} - Registration result
   */
  async registerWithDelhivery(warehouseData, sellerData) {
    try {
      // Create Delhivery API instance
      const delhiveryAPI = new delhivery.DelhiveryAPI();

      const warehouseDetails = {
        name: warehouseData.name,
        pinCode: warehouseData.pincode,
        city: warehouseData.city,
        state: warehouseData.state,
        country: warehouseData.country || 'India',
        addressDetails: warehouseData.address,
        sameAsFwdAdd: true,
        isWarehouse: true,
        active: true
      };

      const result = await delhiveryAPI.b2bCreateWarehouse(warehouseDetails);

      if (result.success) {
        return {
          success: true,
          warehouseId: result.warehouseId,
          message: result.message,
          partner: 'Delhivery',
          data: result.data
        };
      } else {
        return {
          success: false,
          error: result.error,
          partner: 'Delhivery'
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        partner: 'Delhivery'
      };
    }
  }

  /**
   * Register warehouse with DTDC
   * @param {Object} warehouseData - Warehouse data
   * @param {Object} sellerData - Seller data
   * @returns {Object} - Registration result
   */
  async registerWithDtdc(warehouseData, sellerData) {
    // DTDC registration logic would go here
    // For now, return a placeholder
    return {
      success: false,
      error: 'DTDC registration not implemented yet',
      partner: 'DTDC'
    };
  }

  /**
   * Get enabled shipping partners for a seller
   * @param {Object} sellerData - Seller information
   * @returns {Array} - List of enabled partners
   */
  async getEnabledPartners(sellerData) {
    // For now, return a default list
    // In future, this could be configurable per seller or globally
    return [
      { code: 'ekart', name: 'Ekart Logistics', enabled: true },
      { code: 'delhivery', name: 'Delhivery', enabled: true }, // Enable for immediate use
      { code: 'bluedart', name: 'BlueDart', enabled: false },   // Keep disabled for now
      { code: 'dtdc', name: 'DTDC', enabled: false }              // Keep disabled for now
    ].filter(partner => partner.enabled);
  }

  /**
   * Check which partners a warehouse is already registered with
   * @param {Object} warehouseData - Warehouse data
   * @returns {Object} - Registration status per partner
   */
  async checkExistingRegistrations(warehouseData) {
    const status = {};

    try {
      // Check Ekart using the updated service
      logger.info('Checking existing Ekart registrations', {
        warehouse: warehouseData.name,
        pincode: warehouseData.pincode
      });

      // For now, we'll assume warehouse is not registered and let the registration handle duplicates
      status.ekart = {
        registered: false,
        message: 'Registration status will be checked during registration process'
      };

    } catch (error) {
      logger.error('Error checking Ekart registrations:', error.message);
      status.ekart = { registered: false, error: error.message };
    }

    return status;
  }

  /**
   * Check if warehouse is already registered with a specific partner
   * @param {string} warehouseId - Warehouse ID
   * @param {string} partner - Partner code (e.g., 'EKART')
   * @returns {boolean} - Registration status
   */
  async isWarehouseRegistered(warehouseId, partner) {
    try {
      // This would need to be implemented based on how you track registrations
      // For now, return false to allow re-registration
      return false;
    } catch (error) {
      logger.error('Error checking warehouse registration status', {
        warehouseId,
        partner,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Register warehouse with specific partner
   * @param {Object} warehouse - Warehouse object
   * @param {string} partner - Partner code
   * @param {string} sellerId - Seller ID
   * @returns {Object} - Registration result
   */
  async registerWarehouseWithPartner(warehouse, partner, sellerId) {
    try {
      const seller = await Seller.findById(sellerId);
      if (!seller) {
        throw new Error('Seller not found');
      }

      switch (partner.toUpperCase()) {
        case 'EKART':
          return await this.registerWithEkart(warehouse, seller.toObject());
        case 'BLUEDART':
          return await this.registerWithBlueDart(warehouse, seller.toObject());
        case 'DELHIVERY':
          return await this.registerWithDelhivery(warehouse, seller.toObject());
        case 'DTDC':
          return await this.registerWithDtdc(warehouse, seller.toObject());
        default:
          throw new Error(`Unsupported partner: ${partner}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        partner: partner
      };
    }
  }

  /**
   * Validate warehouse data before registration
   * @param {Object} warehouseData - Warehouse data to validate
   * @returns {Object} - Validation result
   */
  validateWarehouseData(warehouseData) {
    const errors = [];

    if (!warehouseData.name || warehouseData.name.trim().length === 0) {
      errors.push('Warehouse name is required');
    }

    if (!warehouseData.address || warehouseData.address.trim().length === 0) {
      errors.push('Warehouse address is required');
    }

    if (!warehouseData.city || warehouseData.city.trim().length === 0) {
      errors.push('City is required');
    }

    if (!warehouseData.state || warehouseData.state.trim().length === 0) {
      errors.push('State is required');
    }

    if (!warehouseData.pincode || !/^\d{6}$/.test(warehouseData.pincode)) {
      errors.push('Valid 6-digit pincode is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate a report of warehouse registrations
   * @param {Object} registrationResults - Results from registration process
   * @returns {string} - Formatted report
   */
  generateRegistrationReport(registrationResults) {
    let report = '\n📋 WAREHOUSE REGISTRATION REPORT\n';
    report += '=====================================\n';
    report += `✅ Successful: ${registrationResults.summary.successfulRegistrations}\n`;
    report += `❌ Failed: ${registrationResults.summary.failedRegistrations}\n`;
    report += `📊 Total Partners: ${registrationResults.summary.totalPartners}\n\n`;

    // Success details
    Object.entries(registrationResults.results).forEach(([partner, result]) => {
      if (result.success) {
        report += `✅ ${result.partner}: ${result.message}\n`;
        if (result.alias) report += `   Alias: ${result.alias}\n`;
        if (result.warning) report += `   ⚠️  ${result.warning}\n`;
      } else {
        report += `❌ ${result.partner}: ${result.error}\n`;
      }
    });

    if (registrationResults.errors.length > 0) {
      report += '\n🚨 ERRORS:\n';
      registrationResults.errors.forEach(error => {
        report += `   • ${error}\n`;
      });
    }

    return report;
  }
}

export default new ShippingPartnerRegistrationService();

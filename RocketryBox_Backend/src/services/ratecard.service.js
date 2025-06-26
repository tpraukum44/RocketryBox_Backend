import RateCard from '../models/ratecard.model.js';

/**
 * RateCard Service
 * Handles all rate card operations for shipping calculations
 */

class RateCardService {
  constructor() {
    // console.log('🔧 RateCard Service initialized');
  }

  /**
   * Get all active rate cards
   */
  async getAllRateCards(filters = {}) {
    try {
      const query = { isActive: true, ...filters };
      const rateCards = await RateCard.find(query).sort({ courier: 1, zone: 1, mode: 1 });

      console.log('📋 Rate cards fetched:', {
        count: rateCards.length,
        filters
      });

      return {
        success: true,
        rateCards,
        count: rateCards.length
      };

    } catch (error) {
      console.error('❌ Error fetching rate cards:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get rate cards by zone
   */
  async getRateCardsByZone(zone, courier = null) {
    try {
      const query = { zone, isActive: true };
      if (courier) {
        query.courier = courier;
      }

      const rateCards = await RateCard.find(query).sort({ courier: 1, baseRate: 1 });

      console.log('🗺️ Rate cards by zone fetched:', {
        zone,
        courier: courier || 'all',
        count: rateCards.length
      });

      return {
        success: true,
        rateCards,
        zone,
        count: rateCards.length
      };

    } catch (error) {
      console.error('❌ Error fetching rate cards by zone:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get rate cards by courier
   */
  async getRateCardsByCourier(courier) {
    try {
      const rateCards = await RateCard.find({
        courier,
        isActive: true
      }).sort({ zone: 1, mode: 1 });

      console.log('🚚 Rate cards by courier fetched:', {
        courier,
        count: rateCards.length
      });

      return {
        success: true,
        rateCards,
        courier,
        count: rateCards.length
      };

    } catch (error) {
      console.error('❌ Error fetching rate cards by courier:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all active couriers
   */
  async getActiveCouriers() {
    try {
      const couriers = await RateCard.getActiveCouriers();

      console.log('🚛 Active couriers fetched:', {
        count: couriers.length,
        couriers
      });

      return {
        success: true,
        couriers
      };

    } catch (error) {
      console.error('❌ Error fetching active couriers:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get city and state from pincode using comprehensive mapping
   */
  getPincodeInfo(pincode) {
    // Comprehensive pincode to city/state mapping
    const pincodeMapping = {
      // Delhi
      '110': { city: 'Delhi', state: 'Delhi', isMetro: true },

      // Mumbai (Maharashtra)
      '400': { city: 'Mumbai', state: 'Maharashtra', isMetro: true },
      '401': { city: 'Mumbai', state: 'Maharashtra', isMetro: true },

      // Bangalore (Karnataka)
      '560': { city: 'Bangalore', state: 'Karnataka', isMetro: true },
      '561': { city: 'Bangalore', state: 'Karnataka', isMetro: true },

      // Chennai (Tamil Nadu)
      '600': { city: 'Chennai', state: 'Tamil Nadu', isMetro: true },
      '601': { city: 'Chennai', state: 'Tamil Nadu', isMetro: true },
      '602': { city: 'Chennai', state: 'Tamil Nadu', isMetro: true },
      '603': { city: 'Chennai', state: 'Tamil Nadu', isMetro: true },

      // Kolkata (West Bengal)
      '700': { city: 'Kolkata', state: 'West Bengal', isMetro: true },
      '701': { city: 'Kolkata', state: 'West Bengal', isMetro: true },

      // Hyderabad (Telangana)
      '500': { city: 'Hyderabad', state: 'Telangana', isMetro: true },
      '501': { city: 'Hyderabad', state: 'Telangana', isMetro: true },

      // Pune (Maharashtra)
      '411': { city: 'Pune', state: 'Maharashtra', isMetro: true },
      '412': { city: 'Pune', state: 'Maharashtra', isMetro: true },

      // Ahmedabad (Gujarat)
      '380': { city: 'Ahmedabad', state: 'Gujarat', isMetro: true },
      '382': { city: 'Ahmedabad', state: 'Gujarat', isMetro: true },

      // Jaipur (Rajasthan)
      '302': { city: 'Jaipur', state: 'Rajasthan', isMetro: true },
      '303': { city: 'Jaipur', state: 'Rajasthan', isMetro: true },

      // Surat (Gujarat)
      '395': { city: 'Surat', state: 'Gujarat', isMetro: true },

      // Kochi (Kerala)
      '682': { city: 'Kochi', state: 'Kerala', isMetro: true },

      // Lucknow (Uttar Pradesh)
      '226': { city: 'Lucknow', state: 'Uttar Pradesh', isMetro: true },

      // Kanpur (Uttar Pradesh)
      '208': { city: 'Kanpur', state: 'Uttar Pradesh', isMetro: true },

      // Nagpur (Maharashtra)
      '440': { city: 'Nagpur', state: 'Maharashtra', isMetro: true },

      // Indore (Madhya Pradesh)
      '452': { city: 'Indore', state: 'Madhya Pradesh', isMetro: true },

      // Bhopal (Madhya Pradesh)
      '462': { city: 'Bhopal', state: 'Madhya Pradesh', isMetro: true },

      // Visakhapatnam (Andhra Pradesh)
      '530': { city: 'Visakhapatnam', state: 'Andhra Pradesh', isMetro: true },

      // Gurgaon (Haryana)
      '122': { city: 'Gurgaon', state: 'Haryana', isMetro: false },

      // Noida (Uttar Pradesh)
      '201': { city: 'Noida', state: 'Uttar Pradesh', isMetro: false },

      // Faridabad (Haryana)
      '121': { city: 'Faridabad', state: 'Haryana', isMetro: false },

      // Ghaziabad (Uttar Pradesh)
      '201': { city: 'Ghaziabad', state: 'Uttar Pradesh', isMetro: false },

      // Other major state mappings
      // Uttar Pradesh
      '200': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '201': { city: 'Noida/Ghaziabad', state: 'Uttar Pradesh', isMetro: false },
      '202': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '203': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '204': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '205': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '206': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '207': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '209': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '210': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '211': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '212': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '213': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '214': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '215': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '216': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '217': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '218': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '219': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '220': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '221': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '222': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '223': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '224': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '225': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '227': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '228': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '229': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '230': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '231': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '232': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '233': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '234': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '235': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '236': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '237': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '238': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '239': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '240': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '241': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '242': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '243': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '244': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '245': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '246': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '247': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '248': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '249': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '250': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '251': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '252': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '253': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '254': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '255': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '256': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '257': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '258': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '259': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '260': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '261': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '262': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '263': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '264': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '270': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '271': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '272': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '273': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '274': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '275': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '276': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '277': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '278': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '279': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '280': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '281': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '282': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '283': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '284': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },
      '285': { city: 'Other', state: 'Uttar Pradesh', isMetro: false },

      // Haryana
      '120': { city: 'Other', state: 'Haryana', isMetro: false },
      '123': { city: 'Other', state: 'Haryana', isMetro: false },
      '124': { city: 'Other', state: 'Haryana', isMetro: false },
      '125': { city: 'Other', state: 'Haryana', isMetro: false },
      '126': { city: 'Other', state: 'Haryana', isMetro: false },
      '127': { city: 'Other', state: 'Haryana', isMetro: false },
      '128': { city: 'Other', state: 'Haryana', isMetro: false },
      '129': { city: 'Other', state: 'Haryana', isMetro: false },
      '130': { city: 'Other', state: 'Haryana', isMetro: false },
      '131': { city: 'Other', state: 'Haryana', isMetro: false },
      '132': { city: 'Other', state: 'Haryana', isMetro: false },
      '133': { city: 'Other', state: 'Haryana', isMetro: false },
      '134': { city: 'Other', state: 'Haryana', isMetro: false },
      '135': { city: 'Other', state: 'Haryana', isMetro: false },
      '136': { city: 'Other', state: 'Haryana', isMetro: false },

      // Rajasthan
      '301': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '304': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '305': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '306': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '307': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '311': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '312': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '313': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '314': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '321': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '322': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '323': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '324': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '325': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '326': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '327': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '328': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '331': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '332': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '333': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '334': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '335': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '341': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '342': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '343': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '344': { city: 'Other', state: 'Rajasthan', isMetro: false },
      '345': { city: 'Other', state: 'Rajasthan', isMetro: false },

      // Gujarat
      '360': { city: 'Other', state: 'Gujarat', isMetro: false },
      '361': { city: 'Other', state: 'Gujarat', isMetro: false },
      '362': { city: 'Other', state: 'Gujarat', isMetro: false },
      '363': { city: 'Other', state: 'Gujarat', isMetro: false },
      '364': { city: 'Other', state: 'Gujarat', isMetro: false },
      '365': { city: 'Other', state: 'Gujarat', isMetro: false },
      '370': { city: 'Other', state: 'Gujarat', isMetro: false },
      '371': { city: 'Other', state: 'Gujarat', isMetro: false },
      '372': { city: 'Other', state: 'Gujarat', isMetro: false },
      '373': { city: 'Other', state: 'Gujarat', isMetro: false },
      '374': { city: 'Other', state: 'Gujarat', isMetro: false },
      '375': { city: 'Other', state: 'Gujarat', isMetro: false },
      '383': { city: 'Other', state: 'Gujarat', isMetro: false },
      '384': { city: 'Other', state: 'Gujarat', isMetro: false },
      '385': { city: 'Other', state: 'Gujarat', isMetro: false },
      '387': { city: 'Other', state: 'Gujarat', isMetro: false },
      '388': { city: 'Other', state: 'Gujarat', isMetro: false },
      '389': { city: 'Other', state: 'Gujarat', isMetro: false },
      '390': { city: 'Other', state: 'Gujarat', isMetro: false },
      '391': { city: 'Other', state: 'Gujarat', isMetro: false },
      '392': { city: 'Other', state: 'Gujarat', isMetro: false },
      '393': { city: 'Other', state: 'Gujarat', isMetro: false },
      '394': { city: 'Other', state: 'Gujarat', isMetro: false },
      '396': { city: 'Other', state: 'Gujarat', isMetro: false },
      '397': { city: 'Other', state: 'Gujarat', isMetro: false },

      // Maharashtra
      '402': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '403': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '404': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '410': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '413': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '414': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '415': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '416': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '417': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '418': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '421': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '422': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '423': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '424': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '425': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '431': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '441': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '442': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '443': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '444': { city: 'Other', state: 'Maharashtra', isMetro: false },
      '445': { city: 'Other', state: 'Maharashtra', isMetro: false },

      // West Bengal
      '711': { city: 'Other', state: 'West Bengal', isMetro: false },
      '712': { city: 'Other', state: 'West Bengal', isMetro: false },
      '713': { city: 'Other', state: 'West Bengal', isMetro: false },
      '721': { city: 'Other', state: 'West Bengal', isMetro: false },
      '722': { city: 'Other', state: 'West Bengal', isMetro: false },
      '731': { city: 'Other', state: 'West Bengal', isMetro: false },
      '732': { city: 'Other', state: 'West Bengal', isMetro: false },
      '733': { city: 'Other', state: 'West Bengal', isMetro: false },
      '734': { city: 'Other', state: 'West Bengal', isMetro: false },
      '735': { city: 'Other', state: 'West Bengal', isMetro: false },
      '736': { city: 'Other', state: 'West Bengal', isMetro: false },
      '741': { city: 'Other', state: 'West Bengal', isMetro: false },
      '742': { city: 'Other', state: 'West Bengal', isMetro: false },
      '743': { city: 'Other', state: 'West Bengal', isMetro: false },
      '744': { city: 'Other', state: 'West Bengal', isMetro: false },
      '751': { city: 'Other', state: 'West Bengal', isMetro: false },

      // Tamil Nadu
      '604': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '605': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '606': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '607': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '608': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '609': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '610': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '611': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '612': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '613': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '614': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '621': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '622': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '623': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '624': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '625': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '626': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '627': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '628': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '629': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '630': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '631': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '632': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '633': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '634': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '635': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '636': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '637': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '638': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '639': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '641': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '642': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '643': { city: 'Other', state: 'Tamil Nadu', isMetro: false },
      '691': { city: 'Other', state: 'Tamil Nadu', isMetro: false },

      // Karnataka
      '562': { city: 'Other', state: 'Karnataka', isMetro: false },
      '563': { city: 'Other', state: 'Karnataka', isMetro: false },
      '564': { city: 'Other', state: 'Karnataka', isMetro: false },
      '565': { city: 'Other', state: 'Karnataka', isMetro: false },
      '571': { city: 'Other', state: 'Karnataka', isMetro: false },
      '572': { city: 'Other', state: 'Karnataka', isMetro: false },
      '573': { city: 'Other', state: 'Karnataka', isMetro: false },
      '574': { city: 'Other', state: 'Karnataka', isMetro: false },
      '575': { city: 'Other', state: 'Karnataka', isMetro: false },
      '576': { city: 'Other', state: 'Karnataka', isMetro: false },
      '577': { city: 'Other', state: 'Karnataka', isMetro: false },
      '581': { city: 'Other', state: 'Karnataka', isMetro: false },
      '582': { city: 'Other', state: 'Karnataka', isMetro: false },
      '583': { city: 'Other', state: 'Karnataka', isMetro: false },
      '584': { city: 'Other', state: 'Karnataka', isMetro: false },
      '585': { city: 'Other', state: 'Karnataka', isMetro: false },
      '586': { city: 'Other', state: 'Karnataka', isMetro: false },
      '587': { city: 'Other', state: 'Karnataka', isMetro: false },
      '591': { city: 'Other', state: 'Karnataka', isMetro: false },

      // Andhra Pradesh / Telangana
      '502': { city: 'Other', state: 'Telangana', isMetro: false },
      '503': { city: 'Other', state: 'Telangana', isMetro: false },
      '504': { city: 'Other', state: 'Telangana', isMetro: false },
      '505': { city: 'Other', state: 'Telangana', isMetro: false },
      '506': { city: 'Other', state: 'Telangana', isMetro: false },
      '507': { city: 'Other', state: 'Telangana', isMetro: false },
      '508': { city: 'Other', state: 'Telangana', isMetro: false },
      '509': { city: 'Other', state: 'Telangana', isMetro: false },
      '510': { city: 'Other', state: 'Andhra Pradesh', isMetro: false },
      '515': { city: 'Other', state: 'Andhra Pradesh', isMetro: false },
      '516': { city: 'Other', state: 'Andhra Pradesh', isMetro: false },
      '517': { city: 'Other', state: 'Andhra Pradesh', isMetro: false },
      '518': { city: 'Other', state: 'Andhra Pradesh', isMetro: false },
      '521': { city: 'Other', state: 'Andhra Pradesh', isMetro: false },
      '522': { city: 'Other', state: 'Andhra Pradesh', isMetro: false },
      '523': { city: 'Other', state: 'Andhra Pradesh', isMetro: false },
      '524': { city: 'Other', state: 'Andhra Pradesh', isMetro: false },
      '531': { city: 'Other', state: 'Andhra Pradesh', isMetro: false },
      '532': { city: 'Other', state: 'Andhra Pradesh', isMetro: false },
      '533': { city: 'Other', state: 'Andhra Pradesh', isMetro: false },
      '534': { city: 'Other', state: 'Andhra Pradesh', isMetro: false },
      '535': { city: 'Other', state: 'Andhra Pradesh', isMetro: false },

      // Kerala
      '670': { city: 'Other', state: 'Kerala', isMetro: false },
      '671': { city: 'Other', state: 'Kerala', isMetro: false },
      '673': { city: 'Other', state: 'Kerala', isMetro: false },
      '678': { city: 'Other', state: 'Kerala', isMetro: false },
      '679': { city: 'Other', state: 'Kerala', isMetro: false },
      '680': { city: 'Other', state: 'Kerala', isMetro: false },
      '683': { city: 'Other', state: 'Kerala', isMetro: false },
      '684': { city: 'Other', state: 'Kerala', isMetro: false },
      '685': { city: 'Other', state: 'Kerala', isMetro: false },
      '686': { city: 'Other', state: 'Kerala', isMetro: false },
      '688': { city: 'Other', state: 'Kerala', isMetro: false },
      '689': { city: 'Other', state: 'Kerala', isMetro: false },
      '690': { city: 'Other', state: 'Kerala', isMetro: false },
      '691': { city: 'Other', state: 'Kerala', isMetro: false },
      '695': { city: 'Other', state: 'Kerala', isMetro: false },
      '696': { city: 'Other', state: 'Kerala', isMetro: false },
      '697': { city: 'Other', state: 'Kerala', isMetro: false },

      // North Eastern States (Special Zone)
      '781': { city: 'Guwahati', state: 'Assam', isMetro: false, isSpecial: true },
      '782': { city: 'Other', state: 'Assam', isMetro: false, isSpecial: true },
      '783': { city: 'Other', state: 'Assam', isMetro: false, isSpecial: true },
      '784': { city: 'Other', state: 'Assam', isMetro: false, isSpecial: true },
      '785': { city: 'Other', state: 'Assam', isMetro: false, isSpecial: true },
      '786': { city: 'Other', state: 'Assam', isMetro: false, isSpecial: true },
      '787': { city: 'Other', state: 'Assam', isMetro: false, isSpecial: true },
      '788': { city: 'Other', state: 'Assam', isMetro: false, isSpecial: true },
      '790': { city: 'Other', state: 'Meghalaya', isMetro: false, isSpecial: true },
      '793': { city: 'Other', state: 'Meghalaya', isMetro: false, isSpecial: true },
      '794': { city: 'Other', state: 'Meghalaya', isMetro: false, isSpecial: true },
      '795': { city: 'Other', state: 'Manipur', isMetro: false, isSpecial: true },
      '796': { city: 'Other', state: 'Manipur', isMetro: false, isSpecial: true },
      '797': { city: 'Other', state: 'Nagaland', isMetro: false, isSpecial: true },
      '798': { city: 'Other', state: 'Nagaland', isMetro: false, isSpecial: true },

      // Jammu & Kashmir (Special Zone)
      '180': { city: 'Other', state: 'Jammu & Kashmir', isMetro: false, isSpecial: true },
      '181': { city: 'Other', state: 'Jammu & Kashmir', isMetro: false, isSpecial: true },
      '182': { city: 'Other', state: 'Jammu & Kashmir', isMetro: false, isSpecial: true },
      '183': { city: 'Other', state: 'Jammu & Kashmir', isMetro: false, isSpecial: true },
      '184': { city: 'Other', state: 'Jammu & Kashmir', isMetro: false, isSpecial: true },
      '185': { city: 'Other', state: 'Jammu & Kashmir', isMetro: false, isSpecial: true },
      '190': { city: 'Other', state: 'Jammu & Kashmir', isMetro: false, isSpecial: true },
      '191': { city: 'Other', state: 'Jammu & Kashmir', isMetro: false, isSpecial: true },
      '192': { city: 'Other', state: 'Jammu & Kashmir', isMetro: false, isSpecial: true },
      '193': { city: 'Other', state: 'Jammu & Kashmir', isMetro: false, isSpecial: true },
      '194': { city: 'Other', state: 'Jammu & Kashmir', isMetro: false, isSpecial: true },
      '196': { city: 'Other', state: 'Jammu & Kashmir', isMetro: false, isSpecial: true },

      // Himachal Pradesh (Special Zone)
      '171': { city: 'Other', state: 'Himachal Pradesh', isMetro: false, isSpecial: true },
      '172': { city: 'Other', state: 'Himachal Pradesh', isMetro: false, isSpecial: true },
      '173': { city: 'Other', state: 'Himachal Pradesh', isMetro: false, isSpecial: true },
      '174': { city: 'Other', state: 'Himachal Pradesh', isMetro: false, isSpecial: true },
      '175': { city: 'Other', state: 'Himachal Pradesh', isMetro: false, isSpecial: true },
      '176': { city: 'Other', state: 'Himachal Pradesh', isMetro: false, isSpecial: true },
      '177': { city: 'Other', state: 'Himachal Pradesh', isMetro: false, isSpecial: true },

      // Punjab
      '140': { city: 'Other', state: 'Punjab', isMetro: false },
      '141': { city: 'Other', state: 'Punjab', isMetro: false },
      '142': { city: 'Other', state: 'Punjab', isMetro: false },
      '143': { city: 'Other', state: 'Punjab', isMetro: false },
      '144': { city: 'Other', state: 'Punjab', isMetro: false },
      '145': { city: 'Other', state: 'Punjab', isMetro: false },
      '146': { city: 'Other', state: 'Punjab', isMetro: false },
      '147': { city: 'Other', state: 'Punjab', isMetro: false },
      '148': { city: 'Other', state: 'Punjab', isMetro: false },
      '149': { city: 'Other', state: 'Punjab', isMetro: false },
      '150': { city: 'Other', state: 'Punjab', isMetro: false },
      '151': { city: 'Other', state: 'Punjab', isMetro: false },
      '152': { city: 'Other', state: 'Punjab', isMetro: false },
      '153': { city: 'Other', state: 'Punjab', isMetro: false },
      '154': { city: 'Other', state: 'Punjab', isMetro: false },
      '155': { city: 'Other', state: 'Punjab', isMetro: false },
      '156': { city: 'Other', state: 'Punjab', isMetro: false },
      '160': { city: 'Chandigarh', state: 'Chandigarh', isMetro: true }, // UT
      '161': { city: 'Other', state: 'Punjab', isMetro: false },

      // Uttarakhand (part of UP range but separate state)
      '244': { city: 'Other', state: 'Uttarakhand', isMetro: false },
      '245': { city: 'Other', state: 'Uttarakhand', isMetro: false },
      '246': { city: 'Other', state: 'Uttarakhand', isMetro: false },
      '247': { city: 'Other', state: 'Uttarakhand', isMetro: false },
      '248': { city: 'Other', state: 'Uttarakhand', isMetro: false },
      '249': { city: 'Other', state: 'Uttarakhand', isMetro: false },
      '263': { city: 'Other', state: 'Uttarakhand', isMetro: false },
      '264': { city: 'Other', state: 'Uttarakhand', isMetro: false },

      // Madhya Pradesh (comprehensive)
      '450': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '451': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '453': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '454': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '455': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '456': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '457': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '458': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '459': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '460': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '461': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '463': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '464': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '465': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '466': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '467': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '468': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '469': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '470': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '471': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '472': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '473': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '474': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '475': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '476': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '477': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '478': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '479': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '480': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '481': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '482': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '483': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '484': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '485': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '486': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '487': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },
      '488': { city: 'Other', state: 'Madhya Pradesh', isMetro: false },

      // Chhattisgarh
      '490': { city: 'Other', state: 'Chhattisgarh', isMetro: false },
      '491': { city: 'Other', state: 'Chhattisgarh', isMetro: false },
      '492': { city: 'Other', state: 'Chhattisgarh', isMetro: false },
      '493': { city: 'Other', state: 'Chhattisgarh', isMetro: false },
      '494': { city: 'Other', state: 'Chhattisgarh', isMetro: false },
      '495': { city: 'Other', state: 'Chhattisgarh', isMetro: false },
      '496': { city: 'Other', state: 'Chhattisgarh', isMetro: false },
      '497': { city: 'Other', state: 'Chhattisgarh', isMetro: false },

      // Goa
      '403': { city: 'Panaji', state: 'Goa', isMetro: false },

      // Bihar
      '800': { city: 'Patna', state: 'Bihar', isMetro: true },
      '801': { city: 'Other', state: 'Bihar', isMetro: false },
      '802': { city: 'Other', state: 'Bihar', isMetro: false },
      '803': { city: 'Other', state: 'Bihar', isMetro: false },
      '804': { city: 'Other', state: 'Bihar', isMetro: false },
      '805': { city: 'Other', state: 'Bihar', isMetro: false },
      '811': { city: 'Other', state: 'Bihar', isMetro: false },
      '812': { city: 'Other', state: 'Bihar', isMetro: false },
      '813': { city: 'Other', state: 'Bihar', isMetro: false },
      '816': { city: 'Other', state: 'Bihar', isMetro: false },
      '821': { city: 'Other', state: 'Bihar', isMetro: false },
      '822': { city: 'Other', state: 'Bihar', isMetro: false },
      '823': { city: 'Other', state: 'Bihar', isMetro: false },
      '824': { city: 'Other', state: 'Bihar', isMetro: false },
      '841': { city: 'Other', state: 'Bihar', isMetro: false },
      '842': { city: 'Other', state: 'Bihar', isMetro: false },
      '843': { city: 'Other', state: 'Bihar', isMetro: false },
      '844': { city: 'Other', state: 'Bihar', isMetro: false },
      '845': { city: 'Other', state: 'Bihar', isMetro: false },
      '846': { city: 'Other', state: 'Bihar', isMetro: false },
      '847': { city: 'Other', state: 'Bihar', isMetro: false },
      '848': { city: 'Other', state: 'Bihar', isMetro: false },
      '851': { city: 'Other', state: 'Bihar', isMetro: false },
      '852': { city: 'Other', state: 'Bihar', isMetro: false },
      '853': { city: 'Other', state: 'Bihar', isMetro: false },
      '854': { city: 'Other', state: 'Bihar', isMetro: false },
      '855': { city: 'Other', state: 'Bihar', isMetro: false },

      // Jharkhand
      '814': { city: 'Other', state: 'Jharkhand', isMetro: false },
      '815': { city: 'Other', state: 'Jharkhand', isMetro: false },
      '825': { city: 'Other', state: 'Jharkhand', isMetro: false },
      '826': { city: 'Other', state: 'Jharkhand', isMetro: false },
      '827': { city: 'Other', state: 'Jharkhand', isMetro: false },
      '828': { city: 'Other', state: 'Jharkhand', isMetro: false },
      '829': { city: 'Other', state: 'Jharkhand', isMetro: false },
      '831': { city: 'Other', state: 'Jharkhand', isMetro: false },
      '832': { city: 'Other', state: 'Jharkhand', isMetro: false },
      '833': { city: 'Other', state: 'Jharkhand', isMetro: false },
      '834': { city: 'Other', state: 'Jharkhand', isMetro: false },
      '835': { city: 'Other', state: 'Jharkhand', isMetro: false },

      // Odisha
      '751': { city: 'Bhubaneswar', state: 'Odisha', isMetro: true },
      '752': { city: 'Other', state: 'Odisha', isMetro: false },
      '753': { city: 'Other', state: 'Odisha', isMetro: false },
      '754': { city: 'Other', state: 'Odisha', isMetro: false },
      '755': { city: 'Other', state: 'Odisha', isMetro: false },
      '756': { city: 'Other', state: 'Odisha', isMetro: false },
      '757': { city: 'Other', state: 'Odisha', isMetro: false },
      '758': { city: 'Other', state: 'Odisha', isMetro: false },
      '759': { city: 'Other', state: 'Odisha', isMetro: false },
      '760': { city: 'Other', state: 'Odisha', isMetro: false },
      '761': { city: 'Other', state: 'Odisha', isMetro: false },
      '762': { city: 'Other', state: 'Odisha', isMetro: false },
      '763': { city: 'Other', state: 'Odisha', isMetro: false },
      '764': { city: 'Other', state: 'Odisha', isMetro: false },
      '765': { city: 'Other', state: 'Odisha', isMetro: false },
      '766': { city: 'Other', state: 'Odisha', isMetro: false },
      '767': { city: 'Other', state: 'Odisha', isMetro: false },
      '768': { city: 'Other', state: 'Odisha', isMetro: false },
      '769': { city: 'Other', state: 'Odisha', isMetro: false },
      '770': { city: 'Other', state: 'Odisha', isMetro: false },

      // Tripura (Special Zone)
      '799': { city: 'Agartala', state: 'Tripura', isMetro: false, isSpecial: true },

      // Mizoram (Special Zone)
      '796': { city: 'Aizawl', state: 'Mizoram', isMetro: false, isSpecial: true },

      // Arunachal Pradesh (Special Zone)
      '790': { city: 'Itanagar', state: 'Arunachal Pradesh', isMetro: false, isSpecial: true },
      '791': { city: 'Other', state: 'Arunachal Pradesh', isMetro: false, isSpecial: true },
      '792': { city: 'Other', state: 'Arunachal Pradesh', isMetro: false, isSpecial: true },

      // Sikkim (Special Zone)
      '737': { city: 'Gangtok', state: 'Sikkim', isMetro: false, isSpecial: true },

      // Union Territories
      // Andaman and Nicobar Islands
      '744': { city: 'Port Blair', state: 'Andaman and Nicobar Islands', isMetro: false, isSpecial: true },

      // Dadra and Nagar Haveli and Daman and Diu
      '396': { city: 'Silvassa', state: 'Dadra and Nagar Haveli and Daman and Diu', isMetro: false },
      '362': { city: 'Daman', state: 'Dadra and Nagar Haveli and Daman and Diu', isMetro: false },

      // Lakshadweep
      '682': { city: 'Kavaratti', state: 'Lakshadweep', isMetro: false, isSpecial: true },

      // Puducherry
      '605': { city: 'Puducherry', state: 'Puducherry', isMetro: false },
      '609': { city: 'Karaikal', state: 'Puducherry', isMetro: false },
      '533': { city: 'Yanam', state: 'Puducherry', isMetro: false },
      '673': { city: 'Mahe', state: 'Puducherry', isMetro: false },

      // Ladakh (Special Zone)
      '194': { city: 'Leh', state: 'Ladakh', isMetro: false, isSpecial: true }
    };

    // Get first 3 digits for lookup
    const prefix = pincode.substring(0, 3);

    // Return info or default
    return pincodeMapping[prefix] || {
      city: 'Unknown',
      state: 'Unknown',
      isMetro: false,
      isSpecial: false
    };
  }

  /**
   * Determine zone based on from and to pincodes with accurate mapping
   */
  async determineZone(fromPincode, toPincode) {
    try {
      const fromInfo = this.getPincodeInfo(fromPincode);
      const toInfo = this.getPincodeInfo(toPincode);



      // 1. Within City - Same city
      if (fromInfo.city === toInfo.city && fromInfo.city !== 'Other' && fromInfo.city !== 'Unknown') {
        return 'Within City';
      }

      // 2. Within State - Same state (but different cities)
      if (fromInfo.state === toInfo.state && fromInfo.state !== 'Unknown') {
        return 'Within State';
      }

      // 3. Special Zone - Either pickup or delivery is in special zone
      if (fromInfo.isSpecial || toInfo.isSpecial) {
        return 'Special Zone';
      }

      // 4. Metro to Metro - Both are metro cities with good connectivity
      if (fromInfo.isMetro && toInfo.isMetro) {
        const fromRegion = this.getRegionFromState(fromInfo.state);
        const toRegion = this.getRegionFromState(toInfo.state);

        // Metro to Metro for major corridors:
        // 1. Same region metros
        if (fromRegion === toRegion) {
          return 'Metro to Metro';
        }

        // 2. Major inter-regional metro corridors (good connectivity)
        const majorMetroCorridors = [
          // North-West corridor (Delhi-Mumbai, etc.)
          ['North', 'West'],
          // North-South corridor (Delhi-Bangalore, Delhi-Chennai, etc.)
          ['North', 'South'],
          // West-South corridor (Mumbai-Bangalore, Mumbai-Chennai, etc.)
          ['West', 'South'],
          // East-Central corridor (Kolkata-Bhopal, etc.)
          ['East', 'Central'],
          // North-Central corridor (Delhi-Bhopal, etc.)
          ['North', 'Central'],
          // East-North corridor (Kolkata-Delhi, etc.)
          ['East', 'North']
        ];

        // Check if this is a major corridor (bidirectional)
        const isCorridorRoute = majorMetroCorridors.some(([region1, region2]) =>
          (fromRegion === region1 && toRegion === region2) ||
          (fromRegion === region2 && toRegion === region1)
        );

        if (isCorridorRoute) {
          return 'Metro to Metro';
        }

        // 3. All other metro pairs go to Rest of India
        // (e.g., very distant routes like Northeast to South, etc.)
      }

      // 5. Within Region - Check if states are in same region (non-metro)
      const fromRegion = this.getRegionFromState(fromInfo.state);
      const toRegion = this.getRegionFromState(toInfo.state);

      if (fromRegion === toRegion && fromRegion !== 'Unknown') {
        return 'Within Region';
      }

      // 6. Default to Rest of India
      return 'Rest of India';

    } catch (error) {
      console.error('❌ Error determining zone:', error);
      return 'Rest of India'; // Default fallback
    }
  }

  /**
   * Get region from state for regional zone determination
   */
  getRegionFromState(state) {
    const regionMapping = {
      // North India
      'Delhi': 'North',
      'Punjab': 'North',
      'Haryana': 'North',
      'Uttar Pradesh': 'North',
      'Uttarakhand': 'North',
      'Himachal Pradesh': 'North',
      'Jammu & Kashmir': 'North',
      'Chandigarh': 'North', // UT
      'Ladakh': 'North', // UT

      // West India
      'Maharashtra': 'West',
      'Gujarat': 'West',
      'Rajasthan': 'West',
      'Goa': 'West',
      'Dadra and Nagar Haveli and Daman and Diu': 'West', // UT

      // South India
      'Karnataka': 'South',
      'Tamil Nadu': 'South',
      'Kerala': 'South',
      'Andhra Pradesh': 'South',
      'Telangana': 'South',
      'Puducherry': 'South', // UT
      'Lakshadweep': 'South', // UT

      // East India
      'West Bengal': 'East',
      'Odisha': 'East',
      'Jharkhand': 'East',
      'Bihar': 'East',
      'Sikkim': 'East',

      // Central India
      'Madhya Pradesh': 'Central',
      'Chhattisgarh': 'Central',

      // Northeast India
      'Assam': 'Northeast',
      'Meghalaya': 'Northeast',
      'Manipur': 'Northeast',
      'Nagaland': 'Northeast',
      'Tripura': 'Northeast',
      'Mizoram': 'Northeast',
      'Arunachal Pradesh': 'Northeast',

      // Island Territories
      'Andaman and Nicobar Islands': 'Islands' // UT
    };

    return regionMapping[state] || 'Unknown';
  }

  /**
   * Get state code from pincode (removed old method)
   */
  getStateFromPincode(pincode) {
    const info = this.getPincodeInfo(pincode);
    return info.state;
  }

  /**
   * Calculate shipping rate for given parameters
   * Updated to match script.js logic exactly
   */
  async calculateShippingRate(calculationData) {
    try {
      const {
        zone, // Direct zone input (for testing/admin)
        fromPincode,
        toPincode,
        weight,
        dimensions,
        mode = 'Surface',
        courier = null,
        orderType = 'prepaid', // 'prepaid' or 'cod'
        codCollectableAmount = 0, // Amount on which COD percentage is calculated
        includeRTO = false, // Whether to include RTO charges
        rateCards = null // Optional: Pre-provided rate cards (for seller-specific rates)
      } = calculationData;

      // Validate required parameters
      if (!zone && (!fromPincode || !toPincode || !weight)) {
        return {
          success: false,
          error: 'Missing required parameters: (zone OR fromPincode+toPincode) and weight'
        };
      }

      // Determine zone - either use provided zone or calculate from pincodes
      let determinedZone;
      if (zone) {
        // Use provided zone directly (for testing/admin purposes)
        determinedZone = zone;
      } else {
        // Determine zone from pincodes
        determinedZone = await this.determineZone(fromPincode, toPincode);
      }

      // Calculate volumetric weight if dimensions provided
      let volumetricWeight = 0;
      if (dimensions && dimensions.length && dimensions.width && dimensions.height) {
        volumetricWeight = (dimensions.length * dimensions.width * dimensions.height) / 5000;
      }

      // Use higher of actual vs volumetric weight (billedWeight in script.js)
      const billedWeight = Math.max(weight, volumetricWeight);

      // Get applicable rate cards
      let applicableRateCards;

      if (rateCards && Array.isArray(rateCards)) {
        // Use provided rate cards (for seller-specific effective rates)
        applicableRateCards = rateCards.filter(rate => {
          let matches = rate.zone === determinedZone && rate.isActive !== false;
          if (courier) matches = matches && rate.courier === courier;
          if (mode) matches = matches && rate.mode === mode;
          return matches;
        });



      } else {
        // Query database for base rate cards (for customers and default case)
        const query = { zone: determinedZone, isActive: true };
        if (courier) {
          query.courier = courier;
        }
        if (mode) {
          query.mode = mode;
        }

        applicableRateCards = await RateCard.find(query).sort({ courier: 1, baseRate: 1 });


      }

      if (applicableRateCards.length === 0) {
        return {
          success: false,
          error: `No rate cards found for zone: ${determinedZone}${courier ? ` and courier: ${courier}` : ''}${rateCards ? ' (seller-specific)' : ' (base rates)'}`
        };
      }

      const calculations = applicableRateCards.map(rate => {
        // Step 1: Calculate final weight considering minimum billable weight
        const finalWeight = Math.max(billedWeight, rate.minimumBillableWeight || 0.5);

        // Step 2: Calculate weight multiplier (exactly as in script.js)
        const weightMultiplier = Math.ceil(finalWeight / 0.5);

        // Step 3: Calculate shipping cost (exactly as in script.js)
        const shippingCost = rate.baseRate + (rate.addlRate * (weightMultiplier - 1));

        // Step 4: Calculate RTO charges (exactly as in script.js)
        let rtoCharges = 0;
        if (includeRTO && rate.rtoCharges) {
          rtoCharges = rate.rtoCharges * weightMultiplier;
        }

        // Step 5: Calculate COD charges (exactly as in script.js)
        let codCharges = 0;
        if (orderType === "cod") {
          if (rate.codAmount && !isNaN(rate.codAmount) && rate.codAmount > 0) {
            // Use fixed COD Amount from rate card
            codCharges = rate.codAmount;
          } else if (rate.codPercent && !isNaN(rate.codPercent) && codCollectableAmount > 0) {
            // COD Percentage of COD Collectable Amount
            codCharges = (rate.codPercent / 100) * codCollectableAmount;
          } else {
            // Fallback if neither fixed COD amount nor valid COD percentage is available
            console.error("Invalid COD charge data: Either codAmount or codPercent is required.");
            codCharges = 0; // Default to 0 if invalid
          }

          // Calculate the COD based on whichever is higher between codAmount or codPercent of codCollectableAmount
          const percentBasedCOD = rate.codPercent && !isNaN(rate.codPercent) && codCollectableAmount > 0
            ? (rate.codPercent / 100) * codCollectableAmount
            : 0;

          // Ensure codCharges is the higher value between codAmount and codPercent-based COD
          codCharges = Math.max(codCharges, percentBasedCOD);
        }

        // Ensure codCharges is a number and parse it to float
        codCharges = isNaN(codCharges) ? 0 : parseFloat(codCharges);

        // Step 6: Calculate GST (exactly as in script.js)
        const gst = 0.18 * (shippingCost + rtoCharges + codCharges);

        // Step 7: Calculate total (exactly as in script.js)
        const total = shippingCost + rtoCharges + codCharges + gst;

        return {
          courier: rate.courier,
          productName: rate.productName,
          mode: rate.mode,
          zone: determinedZone,
          volumetricWeight: Number(volumetricWeight.toFixed(2)),
          finalWeight: Number(finalWeight.toFixed(2)),
          weightMultiplier: Number(weightMultiplier),
          shippingCost: Number(shippingCost.toFixed(2)),
          codCharges: Number(codCharges.toFixed(2)),
          rtoCharges: Number(rtoCharges.toFixed(2)),
          gst: Number(gst.toFixed(2)),
          total: Number(total.toFixed(2)),
          rateCardId: rate._id || rate.baseRateCardId, // Use appropriate ID
          // Additional details for debugging
          baseRate: Number(rate.baseRate.toFixed(2)),
          addlRate: Number(rate.addlRate.toFixed(2)),
          codAmount: rate.codAmount || 0,
          codPercent: rate.codPercent || 0,
          // Add seller-specific information if applicable
          isCustomRate: rate.isOverride || false,
          overrideId: rate.overrideId || null
        };
      });

      // Sort by total cost (ascending)
      calculations.sort((a, b) => a.total - b.total);

      // Remove duplicates: Keep only the cheapest rate for each courier-mode combination
      const uniqueCalculations = [];
      const seenCombinations = new Set();

      calculations.forEach(calc => {
        const key = `${calc.courier}-${calc.mode}`;
        if (!seenCombinations.has(key)) {
          seenCombinations.add(key);
          uniqueCalculations.push(calc);
        } else {
        }
      });



      // Get best options (cheapest per courier) from deduplicated results
      const bestOptions = {};
      uniqueCalculations.forEach(calc => {
        if (!bestOptions[calc.courier] || calc.total < bestOptions[calc.courier].total) {
          bestOptions[calc.courier] = calc;
        }
      });

      const rateSource = rateCards ? 'seller-specific' : 'base';


      return {
        success: true,
        calculations: uniqueCalculations, // Return deduplicated results
        bestOptions: Object.values(bestOptions),
        zone: determinedZone,
        billedWeight: Number(billedWeight.toFixed(2)), // Changed from chargeableWeight to match script.js
        volumetricWeight: Number(volumetricWeight.toFixed(2)),
        deliveryEstimate: this.getDeliveryEstimate(determinedZone, mode),
        requestId: this.generateRequestId(),
        rateSource: rateSource, // Indicate if using base or seller-specific rates
        inputData: {
          fromPincode: fromPincode || null,
          toPincode: toPincode || null,
          zone: zone || null, // Include original zone if provided
          weight,
          dimensions,
          mode,
          courier,
          orderType, // Changed from isCOD to orderType
          codCollectableAmount, // Changed from declaredValue
          includeRTO, // Added includeRTO
          rateSource // Added rate source for debugging
        }
      };

    } catch (error) {
      console.error('❌ Error calculating shipping rate:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get delivery estimate based on zone and mode
   */
  getDeliveryEstimate(zone, mode) {
    const estimates = {
      'Within City': mode === 'Air' ? '1-2 days' : '2-3 days',
      'Within State': mode === 'Air' ? '2-3 days' : '3-4 days',
      'Metro to Metro': mode === 'Air' ? '2-3 days' : '3-5 days',
      'Rest of India': mode === 'Air' ? '3-4 days' : '4-6 days',
      'Special Zone': mode === 'Air' ? '4-5 days' : '6-8 days'
    };
    return estimates[zone] || '4-6 days';
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `RC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get rate card statistics
   */
  async getStatistics() {
    try {
      const totalRateCards = await RateCard.countDocuments({ isActive: true });

      const courierStats = await RateCard.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$courier', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      const zoneStats = await RateCard.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$zone', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      const modeStats = await RateCard.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$mode', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      console.log('📊 Rate card statistics fetched:', {
        totalRateCards,
        couriers: courierStats.length,
        zones: zoneStats.length
      });

      return {
        success: true,
        statistics: {
          totalRateCards,
          byCategory: {
            courier: courierStats,
            zone: zoneStats,
            mode: modeStats
          }
        }
      };

    } catch (error) {
      console.error('❌ Error fetching rate card statistics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create or update rate card
   */
  async createOrUpdateRateCard(rateCardData) {
    try {
      const {
        courier,
        productName,
        mode,
        zone,
        baseRate,
        addlRate,
        codAmount,
        codPercent,
        rtoCharges,
        minimumBillableWeight
      } = rateCardData;

      // Check if rate card already exists
      const existingRateCard = await RateCard.findOne({
        courier,
        productName,
        mode,
        zone
      });

      let rateCard;
      if (existingRateCard) {
        // Update existing rate card
        rateCard = await RateCard.findByIdAndUpdate(
          existingRateCard._id,
          {
            baseRate,
            addlRate,
            codAmount,
            codPercent,
            rtoCharges,
            minimumBillableWeight,
            isActive: true
          },
          { new: true }
        );

        console.log('✏️ Rate card updated:', {
          id: rateCard._id,
          courier: rateCard.courier,
          zone: rateCard.zone
        });
      } else {
        // Create new rate card
        rateCard = await RateCard.create(rateCardData);

        console.log('✅ Rate card created:', {
          id: rateCard._id,
          courier: rateCard.courier,
          zone: rateCard.zone
        });
      }

      return {
        success: true,
        rateCard,
        isNew: !existingRateCard
      };

    } catch (error) {
      console.error('❌ Error creating/updating rate card:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Deactivate rate card
   */
  async deactivateRateCard(rateCardId) {
    try {
      const rateCard = await RateCard.findByIdAndUpdate(
        rateCardId,
        { isActive: false },
        { new: true }
      );

      if (!rateCard) {
        return {
          success: false,
          error: 'Rate card not found'
        };
      }

      console.log('🚫 Rate card deactivated:', {
        id: rateCard._id,
        courier: rateCard.courier,
        zone: rateCard.zone
      });

      return {
        success: true,
        rateCard
      };

    } catch (error) {
      console.error('❌ Error deactivating rate card:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Health check for RateCard service
   */
  async healthCheck() {
    try {
      const activeCount = await RateCard.countDocuments({ isActive: true });
      const totalCount = await RateCard.countDocuments();

      console.log('🩺 RateCard service health check passed:', {
        activeRateCards: activeCount,
        totalRateCards: totalCount
      });

      return {
        success: true,
        status: 'healthy',
        data: {
          activeRateCards: activeCount,
          totalRateCards: totalCount,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('❌ RateCard service health check failed:', error);
      return {
        success: false,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export const rateCardService = new RateCardService();
export default rateCardService;

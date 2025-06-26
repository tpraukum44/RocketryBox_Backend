import { logger } from './logger.js';
import { getPincodeDetails } from './pincode.js';

// Sample rate card data structure (expand as needed)
export const rateCard = {
  'Bluedart air': {
    slabs: [0.5, 1, 2, 5, 10],
    zones: {
      'WITHIN_CITY': { base: [37, 45, 48, 49, 64], addl: [36, 43, 47, 48, 62], cod: 35, codPct: 1.5 },
      'WITHIN_STATE': { base: [45, 52, 60, 64, 87], addl: [43, 52, 59, 64, 86], cod: 35, codPct: 1.5 },
      'METRO_TO_METRO': { base: [48, 60, 89, 193, 227], addl: [47, 59, 60, 64, 87], cod: 35, codPct: 1.5 },
      'REST_OF_INDIA': { base: [49, 64, 99, 193, 369], addl: [48, 63, 64, 64, 64], cod: 35, codPct: 1.5 },
      'NORTH_EAST': { base: [64, 87, 131, 227, 430], addl: [62, 86, 87, 87, 87], cod: 35, codPct: 1.5 }
    }
  },
  'Bluedart surface': {
    slabs: [0.5, 1, 2, 5, 10],
    zones: {
      'WITHIN_CITY': { base: [32, 40, 43, 44, 59], addl: [31, 38, 42, 43, 57], cod: 35, codPct: 1.5 },
      'WITHIN_STATE': { base: [40, 47, 55, 59, 82], addl: [38, 47, 54, 59, 81], cod: 35, codPct: 1.5 },
      'METRO_TO_METRO': { base: [43, 55, 84, 188, 222], addl: [42, 54, 55, 59, 82], cod: 35, codPct: 1.5 },
      'REST_OF_INDIA': { base: [44, 59, 94, 188, 364], addl: [43, 58, 59, 59, 59], cod: 35, codPct: 1.5 },
      'NORTH_EAST': { base: [59, 82, 126, 222, 425], addl: [57, 81, 82, 82, 82], cod: 35, codPct: 1.5 }
    }
  },
  'Delhivery air': {
    slabs: [0.5, 1, 2, 5, 10],
    zones: {
      'WITHIN_CITY': { base: [35, 52, 72, 144, 265], addl: [33, 51, 52, 52, 52], cod: 35, codPct: 1.75 },
      'WITHIN_STATE': { base: [37, 55, 77, 152, 278], addl: [35, 54, 55, 55, 55], cod: 35, codPct: 1.75 },
      'METRO_TO_METRO': { base: [49, 63, 92, 174, 328], addl: [46, 62, 63, 63, 63], cod: 35, codPct: 1.75 },
      'REST_OF_INDIA': { base: [52, 67, 102, 196, 372], addl: [49, 66, 67, 67, 67], cod: 35, codPct: 1.75 },
      'NORTH_EAST': { base: [71, 90, 134, 230, 433], addl: [67, 89, 90, 90, 90], cod: 35, codPct: 1.75 }
    }
  },
  'Delhivery surface': {
    slabs: [0.5, 1, 2, 5, 10],
    zones: {
      'WITHIN_CITY': { base: [32, 49, 69, 141, 262], addl: [30, 48, 49, 49, 49], cod: 35, codPct: 1.75 },
      'WITHIN_STATE': { base: [34, 52, 74, 149, 275], addl: [32, 51, 52, 52, 52], cod: 35, codPct: 1.75 },
      'METRO_TO_METRO': { base: [46, 60, 89, 171, 325], addl: [43, 59, 60, 60, 60], cod: 35, codPct: 1.75 },
      'REST_OF_INDIA': { base: [49, 64, 99, 193, 369], addl: [46, 63, 64, 64, 64], cod: 35, codPct: 1.75 },
      'NORTH_EAST': { base: [68, 87, 131, 227, 430], addl: [64, 86, 87, 87, 87], cod: 35, codPct: 1.75 }
    }
  },

  'Ekart air': {
    slabs: [0.5, 1, 2, 5, 10],
    zones: {
      'WITHIN_CITY': { base: [34, 52, 72, 144, 265], addl: [32, 51, 52, 52, 52], cod: 30, codPct: 1.5 },
      'WITHIN_STATE': { base: [36, 55, 77, 152, 278], addl: [34, 54, 55, 55, 55], cod: 30, codPct: 1.5 },
      'METRO_TO_METRO': { base: [41, 63, 92, 174, 328], addl: [39, 62, 63, 63, 63], cod: 30, codPct: 1.5 },
      'REST_OF_INDIA': { base: [43, 67, 102, 196, 372], addl: [41, 66, 67, 67, 67], cod: 30, codPct: 1.5 },
      'NORTH_EAST': { base: [48, 90, 134, 230, 433], addl: [46, 89, 90, 90, 90], cod: 30, codPct: 1.5 }
    }
  },
  'Ekart surface': {
    slabs: [0.5, 1, 2, 5, 10],
    zones: {
      'WITHIN_CITY': { base: [31, 49, 69, 141, 262], addl: [29, 48, 49, 49, 49], cod: 30, codPct: 1.5 },
      'WITHIN_STATE': { base: [33, 52, 74, 149, 275], addl: [31, 51, 52, 52, 52], cod: 30, codPct: 1.5 },
      'METRO_TO_METRO': { base: [38, 60, 89, 171, 325], addl: [36, 59, 60, 60, 60], cod: 30, codPct: 1.5 },
      'REST_OF_INDIA': { base: [40, 64, 99, 193, 369], addl: [38, 63, 64, 64, 64], cod: 30, codPct: 1.5 },
      'NORTH_EAST': { base: [45, 87, 131, 227, 430], addl: [43, 86, 87, 87, 87], cod: 30, codPct: 1.5 }
    }
  },
  'Xpressbees air': {
    slabs: [0.5, 1, 2, 5, 10],
    zones: {
      'WITHIN_CITY': { base: [30, 43, 67, 101, 152], addl: [19, 33, 52, 55, 55], cod: 27, codPct: 1.18 },
      'WITHIN_STATE': { base: [30, 43, 67, 101, 152], addl: [19, 33, 52, 55, 55], cod: 27, codPct: 1.18 },
      'METRO_TO_METRO': { base: [40, 61, 72, 113, 164], addl: [37, 38, 63, 23, 23], cod: 27, codPct: 1.18 },
      'REST_OF_INDIA': { base: [54, 61, 79, 126, 177], addl: [43, 38, 28, 23, 25], cod: 27, codPct: 1.18 },
      'NORTH_EAST': { base: [58, 72, 92, 152, 241], addl: [50, 72, 92, 152, 25], cod: 27, codPct: 1.18 }
    }
  },
  'Xpressbees surface': {
    slabs: [0.5, 1, 2, 5, 10],
    zones: {
      'WITHIN_CITY': { base: [27, 40, 64, 98, 149], addl: [16, 30, 49, 52, 52], cod: 27, codPct: 1.18 },
      'WITHIN_STATE': { base: [27, 40, 64, 98, 149], addl: [16, 30, 49, 52, 52], cod: 27, codPct: 1.18 },
      'METRO_TO_METRO': { base: [37, 58, 69, 110, 161], addl: [34, 35, 60, 20, 20], cod: 27, codPct: 1.18 },
      'REST_OF_INDIA': { base: [51, 58, 76, 123, 174], addl: [40, 35, 25, 20, 22], cod: 27, codPct: 1.18 },
      'NORTH_EAST': { base: [55, 69, 89, 149, 238], addl: [47, 69, 89, 149, 22], cod: 27, codPct: 1.18 }
    }
  },
  'Shadowfax': {
    slabs: [0.5, 1, 2, 5, 10],
    zones: {
      'WITHIN_CITY': { base: [25, 35, 45, 65, 85], addl: [20, 30, 40, 50, 60], cod: 25, codPct: 1.0 },
      'WITHIN_STATE': { base: [30, 40, 50, 70, 90], addl: [25, 35, 45, 55, 65], cod: 25, codPct: 1.0 },
      'METRO_TO_METRO': { base: [35, 45, 55, 75, 95], addl: [30, 40, 50, 60, 70], cod: 25, codPct: 1.0 },
      'REST_OF_INDIA': { base: [40, 50, 60, 80, 100], addl: [35, 45, 55, 65, 75], cod: 25, codPct: 1.0 },
      'NORTH_EAST': { base: [45, 55, 65, 85, 105], addl: [40, 50, 60, 70, 80], cod: 25, codPct: 1.0 }
    }
  },
  'Dunzo': {
    slabs: [0.5, 1, 2, 5, 10],
    zones: {
      'WITHIN_CITY': { base: [30, 40, 50, 70, 90], addl: [25, 35, 45, 55, 65], cod: 30, codPct: 1.2 },
      'WITHIN_STATE': { base: [35, 45, 55, 75, 95], addl: [30, 40, 50, 60, 70], cod: 30, codPct: 1.2 },
      'METRO_TO_METRO': { base: [40, 50, 60, 80, 100], addl: [35, 45, 55, 65, 75], cod: 30, codPct: 1.2 },
      'REST_OF_INDIA': { base: [45, 55, 65, 85, 105], addl: [40, 50, 60, 70, 80], cod: 30, codPct: 1.2 },
      'NORTH_EAST': { base: [50, 60, 70, 90, 110], addl: [45, 55, 65, 75, 85], cod: 30, codPct: 1.2 }
    }
  },
  'Swiggy Genie': {
    slabs: [0.5, 1, 2, 5, 10],
    zones: {
      'WITHIN_CITY': { base: [35, 45, 55, 75, 95], addl: [30, 40, 50, 60, 70], cod: 35, codPct: 1.3 },
      'WITHIN_STATE': { base: [40, 50, 60, 80, 100], addl: [35, 45, 55, 65, 75], cod: 35, codPct: 1.3 },
      'METRO_TO_METRO': { base: [45, 55, 65, 85, 105], addl: [40, 50, 60, 70, 80], cod: 35, codPct: 1.3 },
      'REST_OF_INDIA': { base: [50, 60, 70, 90, 110], addl: [45, 55, 65, 75, 85], cod: 35, codPct: 1.3 },
      'NORTH_EAST': { base: [55, 65, 75, 95, 115], addl: [50, 60, 70, 80, 90], cod: 35, codPct: 1.3 }
    }
  }
};

// Sample pincode to city/state mapping (expand for real use)
const pincodeData = {
  '400001': { city: 'Mumbai', state: 'Maharashtra' },
  '110001': { city: 'Delhi', state: 'Delhi' },
  '560001': { city: 'Bangalore', state: 'Karnataka' },
  '700001': { city: 'Kolkata', state: 'West Bengal' },
  '600001': { city: 'Chennai', state: 'Tamil Nadu' },
  '500001': { city: 'Hyderabad', state: 'Telangana' },
  '411001': { city: 'Pune', state: 'Maharashtra' },
  '380001': { city: 'Ahmedabad', state: 'Gujarat' },
  '793001': { city: 'Shillong', state: 'Meghalaya' }, // North East
  '190001': { city: 'Srinagar', state: 'Jammu & Kashmir' }, // J&K
  // ...add more as needed
};

const metroCities = ['Mumbai', 'Delhi', 'Bangalore', 'Kolkata', 'Chennai', 'Hyderabad', 'Pune', 'Ahmedabad'];
const northEastStates = [
  'Arunachal Pradesh', 'Assam', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Tripura', 'Sikkim', 'Jammu & Kashmir'
];

// Make determineZone async to use DB
export async function determineZone(pickupPincode, deliveryPincode) {
  try {
    const pickup = await getPincodeDetails(pickupPincode);
    const delivery = await getPincodeDetails(deliveryPincode);

    if (!pickup || !delivery) {
      logger.info('Pincode details not found, using fallback zone determination');
      return 'REST_OF_INDIA';
    }

    // North East/J&K logic
    if (northEastStates.includes(delivery.state)) return 'NORTH_EAST';

    if (pickup.district === delivery.district && pickup.state === delivery.state) return 'WITHIN_CITY';
    if (pickup.state === delivery.state) return 'WITHIN_STATE';

    if (metroCities.includes(pickup.district) && metroCities.includes(delivery.district)) return 'METRO_TO_METRO';

    return 'REST_OF_INDIA';
  } catch (error) {
    logger.error('Error in determineZone:', error);
    return 'REST_OF_INDIA'; // Safe fallback
  }
}

// Find the correct slab index for a given weight
function getSlabIndex(slabs, weight) {
  for (let i = 0; i < slabs.length; i++) {
    if (weight <= slabs[i]) return i;
  }
  return slabs.length - 1; // Use the highest slab if overweight
}

// Calculate rate for a single courier
function calculateRateForCourier(courier, weight, zone, isCOD) {
  const { slabs, zones } = rateCard[courier];
  const zoneRates = zones[zone];
  const slabIdx = getSlabIndex(slabs, weight);
  let base = zoneRates.base[slabIdx];
  let addl = zoneRates.addl[slabIdx];
  // Calculate additional weight charges
  const slabWeight = slabs[slabIdx];
  let additionalWeight = Math.max(0, weight - slabWeight);
  let addlUnits = Math.ceil(additionalWeight / 0.5);
  let addlCharge = addlUnits * addl;
  let total = base + addlCharge;
  // Add COD charges if applicable
  if (isCOD) {
    total += zoneRates.cod + (zoneRates.codPct / 100) * total;
  }
  return {
    courier,
    zone,
    weight,
    base,
    addl,
    addlCharge,
    cod: isCOD ? zoneRates.cod : 0,
    codPct: isCOD ? zoneRates.codPct : 0,
    total: Math.round(total)
  };
}

// Main function: calculate rates for all couriers (now async)
export async function calculateCourierRates({ weight, pickupPincode, deliveryPincode, isCOD }) {
  try {
    logger.info('Calculating courier rates:', { weight, pickupPincode, deliveryPincode, isCOD });

    const zone = await determineZone(pickupPincode, deliveryPincode);
    logger.info('Determined zone:', zone);

    const rates = Object.keys(rateCard).map(courier => {
      try {
        return calculateRateForCourier(courier, weight, zone, isCOD);
      } catch (error) {
        logger.error(`Error calculating rate for ${courier}:`, error);
        // Return fallback rate for this courier
        return {
          courier,
          zone,
          weight,
          base: 50,
          addl: 20,
          addlCharge: Math.ceil((weight - 0.5) / 0.5) * 20,
          cod: isCOD ? 35 : 0,
          codPct: isCOD ? 1.5 : 0,
          total: Math.round(50 + Math.ceil((weight - 0.5) / 0.5) * 20 + (isCOD ? 35 : 0)),
          _fallback: true
        };
      }
    });

    logger.info('Calculated rates:', rates.length, 'couriers');
    return rates;
  } catch (error) {
    logger.error('Error in calculateCourierRates:', error);

    // Return basic fallback rates
    return [
      {
        courier: 'Fallback Express',
        zone: 'REST_OF_INDIA',
        weight,
        base: 50,
        addl: 20,
        addlCharge: Math.ceil((weight - 0.5) / 0.5) * 20,
        cod: isCOD ? 35 : 0,
        codPct: isCOD ? 1.5 : 0,
        total: Math.round(50 + Math.ceil((weight - 0.5) / 0.5) * 20 + (isCOD ? 35 : 0)),
        _fallback: true,
        _error: error.message
      }
    ];
  }
}

// Calculate rate for a package using the rate card
export function calculateRate(packageDetails, deliveryDetails, partnerDetails) {
  const { weight, dimensions, paymentMode } = packageDetails;
  const { pickupPincode, deliveryPincode } = deliveryDetails;
  const isCOD = paymentMode === 'COD';

  // Determine service type based on partner details
  const serviceType = partnerDetails.name.toLowerCase().includes('surface') ? 'surface' : 'air';
  const courierKey = `${partnerDetails.name} ${serviceType}`;

  // Get zone for this shipment
  return determineZone(pickupPincode, deliveryPincode)
    .then(zone => {
      // Check if this courier exists in our rate card
      if (!rateCard[courierKey]) {
        // Fallback to generic calculation
        return {
          courier: partnerDetails.name,
          serviceType,
          weight,
          total: Math.round(50 + weight * 20), // Generic calculation
          estimatedDelivery: serviceType === 'air' ? '2-3 days' : '4-6 days'
        };
      }

      // Calculate the rate using our rate card
      const calculatedRate = calculateRateForCourier(courierKey, weight, zone, isCOD);

      return {
        courier: partnerDetails.name,
        serviceType,
        weight,
        zone,
        total: calculatedRate.total,
        breakdown: {
          base: calculatedRate.base,
          additionalWeight: calculatedRate.addlCharge,
          cod: calculatedRate.cod
        },
        estimatedDelivery: serviceType === 'air' ? '2-3 days' : '4-6 days'
      };
    })
    .catch(error => {
      logger.error(`Error calculating rate: ${error.message}`);
      // Return fallback calculation
      return {
        courier: partnerDetails.name,
        serviceType,
        weight,
        total: Math.round(50 + weight * 20), // Generic calculation
        estimatedDelivery: serviceType === 'air' ? '2-3 days' : '4-6 days',
        error: 'Could not determine accurate rate'
      };
    });
}

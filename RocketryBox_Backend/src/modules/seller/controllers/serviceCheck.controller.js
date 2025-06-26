import { AppError } from '../../../middleware/errorHandler.js';

// Dummy data for demonstration; replace with real DB/service logic
const PINCODE_DB = {
  '110001': {
    city: 'New Delhi',
    state: 'Delhi',
    isAvailable: true,
    services: { standard: true, express: true, cod: true },
    deliveryTime: { standard: '2-3 days', express: '1-2 days' },
    restrictions: []
  },
  '400001': {
    city: 'Mumbai',
    state: 'Maharashtra',
    isAvailable: true,
    services: { standard: true, express: true, cod: false },
    deliveryTime: { standard: '3-4 days', express: '2-3 days' },
    restrictions: ['No COD']
  }
};

const RESTRICTIONS_DB = {
  '110001': {
    standard: [
      { type: 'holiday', description: 'No delivery on Sundays', appliesTo: ['standard'], effectiveFrom: null, effectiveUntil: null }
    ],
    express: [],
    cod: []
  },
  '400001': {
    standard: [],
    express: [],
    cod: [
      { type: 'cod_blocked', description: 'COD not available for this pincode', appliesTo: ['cod'], effectiveFrom: null, effectiveUntil: null }
    ]
  }
};

// POST /service-check/pincode
export const bulkServiceCheck = async (req, res, next) => {
  try {
    const { pincodes } = req.body;
    if (!Array.isArray(pincodes) || pincodes.length === 0) {
      throw new AppError('pincodes array is required', 400);
    }
    const results = pincodes.map(pincode => {
      const data = PINCODE_DB[pincode] || {
        city: '',
        state: '',
        isAvailable: false,
        services: { standard: false, express: false, cod: false },
        deliveryTime: { standard: '', express: '' },
        restrictions: ['Not Serviceable']
      };
      return { pincode, ...data };
    });
    const summary = {
      total: pincodes.length,
      available: results.filter(r => r.isAvailable).length,
      unavailable: results.filter(r => !r.isAvailable).length
    };
    res.status(200).json({ success: true, data: { results, summary } });
  } catch (error) {
    next(error);
  }
};

// GET /service-check/restrictions
export const getServiceRestrictions = async (req, res, next) => {
  try {
    const { pincode, serviceType } = req.query;
    if (!pincode || !serviceType) {
      throw new AppError('pincode and serviceType are required', 400);
    }
    const restrictions = (RESTRICTIONS_DB[pincode] && RESTRICTIONS_DB[pincode][serviceType]) || [];
    res.status(200).json({ success: true, data: { restrictions, specialInstructions: '' } });
  } catch (error) {
    next(error);
  }
}; 
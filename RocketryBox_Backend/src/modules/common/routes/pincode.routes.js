import express from 'express';
import { getPincodeDetails, searchPincodeData, getStates, getDistricts } from '../controllers/pincode.controller.js';

const router = express.Router();

/**
 * @route GET /api/pincodes/search
 * @desc Search pincodes with filters
 * @access Public
 */
router.get('/search', searchPincodeData);

/**
 * @route GET /api/pincodes/states
 * @desc Get all states
 * @access Public
 */
router.get('/states', getStates);

/**
 * @route GET /api/pincodes/states/:state/districts
 * @desc Get districts by state
 * @access Public
 */
router.get('/states/:state/districts', getDistricts);

/**
 * @route GET /api/pincodes/:pincode
 * @desc Get details for a specific pincode
 * @access Public
 */
router.get('/:pincode', getPincodeDetails);

export default router; 
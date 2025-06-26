import express from 'express';
import multer from 'multer';
import { authenticateSeller } from '../../../middleware/auth.js';
import { validationHandler } from '../../../middleware/validator.js';
import {
  updateWeightDisputeSchema,
  uploadWeightDisputeFileSchema
} from '../validators/weightDispute.validator.js';
import {
  listWeightDisputes,
  getWeightDisputeDetails,
  updateWeightDispute,
  uploadWeightDisputeFile
} from '../controllers/weightDispute.controller.js';

const router = express.Router();
const upload = multer();

router.use(authenticateSeller);

// List disputes
router.get('/', listWeightDisputes);
// Get dispute details
router.get('/:awbNumber', getWeightDisputeDetails);
// Update dispute
router.put('/:awbNumber', validationHandler(updateWeightDisputeSchema), updateWeightDispute);
// Upload disputes (Excel)
router.post('/upload', upload.single('file'), validationHandler(uploadWeightDisputeFileSchema), uploadWeightDisputeFile);

export default router; 

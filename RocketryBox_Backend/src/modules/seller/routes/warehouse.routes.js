import express from 'express';
import { authenticateSeller } from '../../../middleware/auth.js';
import { validationHandler } from '../../../middleware/validator.js';
import {
  addStockToItem,
  addWarehouse,
  checkWarehouseRegistrationStatus,
  listWarehouseItems,
  listWarehouses,
  registerWarehouseWithPartners
} from '../controllers/warehouse.controller.js';
import { addStockSchema, addWarehouseSchema } from '../validators/warehouse.validator.js';

const router = express.Router();

router.use(authenticateSeller);

// Warehouse management routes
router.get('/', listWarehouses);
router.post('/', validationHandler(addWarehouseSchema), addWarehouse);

// Shipping partner registration routes
router.post('/:warehouseId/register-partners', registerWarehouseWithPartners);
router.get('/:warehouseId/registration-status', checkWarehouseRegistrationStatus);

// Warehouse items management routes
router.get('/items', listWarehouseItems);
router.post('/items/:itemId/stock', validationHandler(addStockSchema), addStockToItem);

export default router;

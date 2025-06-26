import express from 'express';
import { authenticateSeller } from '../../../middleware/auth.js';
import { validationHandler } from '../../../middleware/validator.js';
import { addStoreSchema, updateStoreSchema } from '../validators/store.validator.js';
import { listStores, addStore, getStore, updateStore, deleteStore } from '../controllers/store.controller.js';

const router = express.Router();

router.use(authenticateSeller);

// List stores
router.get('/stores', listStores);
// Add store
router.post('/stores', validationHandler(addStoreSchema), addStore);
// Get store details
router.get('/stores/:id', getStore);
// Update store
router.put('/stores/:id', validationHandler(updateStoreSchema), updateStore);
// Delete store
router.delete('/stores/:id', deleteStore);

export default router; 

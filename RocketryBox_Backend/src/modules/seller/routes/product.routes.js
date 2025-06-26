import express from 'express';
import { authenticateSeller } from '../../../middleware/auth.js';
import { validationHandler } from '../../../middleware/validator.js';
import { addProductSchema, updateProductSchema } from '../validators/product.validator.js';
import { listProducts, addProduct, getProduct, updateProduct, deleteProduct } from '../controllers/product.controller.js';

const router = express.Router();

router.use(authenticateSeller);

// List products
router.get('/products', listProducts);
// Add product
router.post('/products', validationHandler(addProductSchema), addProduct);
// Get product details
router.get('/products/:id', getProduct);
// Update product
router.put('/products/:id', validationHandler(updateProductSchema), updateProduct);
// Delete product
router.delete('/products/:id', deleteProduct);

export default router; 

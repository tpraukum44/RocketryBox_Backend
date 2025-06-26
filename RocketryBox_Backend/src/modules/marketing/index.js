import express from 'express';
import marketingRoutes from './routes/marketing.routes.js';

const router = express.Router();

router.use('/', marketingRoutes);

export default router; 
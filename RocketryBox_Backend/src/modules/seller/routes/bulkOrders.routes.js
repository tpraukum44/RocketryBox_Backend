import express from 'express';
import multer from 'multer';
import path from 'path';
import { 
    uploadBulkOrders, 
    getBulkOrderStatus, 
    cancelBulkOrder,
    getUploadHistory,
    downloadErrorFile,
    toggleUploadDetails,
    downloadTemplate
} from '../controllers/bulkOrders.controller.js';
import { authenticateSeller } from '../../../middleware/auth.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/bulk-orders');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `bulk-order-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.xlsx', '.xls'];
        const fileExt = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(fileExt)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
        }
    }
});

// Apply authentication middleware to all routes
router.use(authenticateSeller);

// Routes
router.post('/upload', upload.single('file'), uploadBulkOrders);
router.get('/:orderId/status', getBulkOrderStatus);
router.post('/:orderId/cancel', cancelBulkOrder);
router.get('/history', getUploadHistory);
router.get('/:uploadId/error-file', downloadErrorFile);
router.post('/:uploadId/toggle-details', toggleUploadDetails);
router.get('/template', downloadTemplate);

export default router; 

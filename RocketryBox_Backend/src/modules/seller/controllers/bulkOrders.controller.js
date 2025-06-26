import fs from 'fs';
import XLSX from 'xlsx';
import { AppError } from '../../../middleware/errorHandler.js';
import { catchAsync } from '../../../utils/catchAsync.js';
import { logger } from '../../../utils/logger.js';
import { BulkOrderUpload } from '../models/bulkOrderUpload.model.js';
import Order from '../models/order.model.js';

// Upload bulk orders from Excel file
export const uploadBulkOrders = catchAsync(async (req, res, next) => {
  const { file } = req;
  const sellerId = req.user.id;

  if (!file) {
    return next(new AppError('No file uploaded', 400));
  }

  try {
    // Read Excel file
    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length < 2) {
      return next(new AppError('Excel file must contain at least header and one data row', 400));
    }

    const headers = data[0];
    const rows = data.slice(1);

    // Create bulk upload record
    const bulkUpload = new BulkOrderUpload({
      sellerId,
      originalFileName: file.originalname,
      filePath: file.path,
      totalRows: rows.length,
      status: 'Processing',
      uploadedAt: new Date(),
      uploadErrors: []
    });

    await bulkUpload.save();

    // Process orders in background
    processOrdersInBackground(bulkUpload._id, headers, rows, sellerId);

    res.status(200).json({
      success: true,
      data: {
        orderId: bulkUpload._id,
        status: 'Processing',
        totalRows: rows.length,
        processedRows: 0,
        failedRows: 0,
        createdAt: bulkUpload.uploadedAt,
        updatedAt: bulkUpload.uploadedAt
      },
      message: 'Bulk order upload started successfully'
    });

  } catch (error) {
    logger.error('Error processing bulk order file:', error);

    // Clean up uploaded file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return next(new AppError('Failed to process Excel file', 500));
  }
});

// Get bulk order status
export const getBulkOrderStatus = catchAsync(async (req, res, next) => {
  const { orderId } = req.params;
  const sellerId = req.user.id;

  const bulkUpload = await BulkOrderUpload.findOne({
    _id: orderId,
    sellerId
  });

  if (!bulkUpload) {
    return next(new AppError('Bulk order upload not found', 404));
  }

  const progress = bulkUpload.totalRows > 0
    ? Math.round((bulkUpload.processedRows / bulkUpload.totalRows) * 100)
    : 0;

  res.status(200).json({
    success: true,
    data: {
      orderId: bulkUpload._id,
      status: bulkUpload.status,
      progress,
      totalRows: bulkUpload.totalRows,
      processedRows: bulkUpload.processedRows,
      failedRows: bulkUpload.failedRows,
      errors: bulkUpload.uploadErrors,
      createdAt: bulkUpload.uploadedAt,
      updatedAt: bulkUpload.updatedAt
    }
  });
});

// Cancel bulk order processing
export const cancelBulkOrder = catchAsync(async (req, res, next) => {
  const { orderId } = req.params;
  const sellerId = req.user.id;

  const bulkUpload = await BulkOrderUpload.findOne({
    _id: orderId,
    sellerId
  });

  if (!bulkUpload) {
    return next(new AppError('Bulk order upload not found', 404));
  }

  if (bulkUpload.status === 'Completed') {
    return next(new AppError('Cannot cancel completed upload', 400));
  }

  bulkUpload.status = 'Cancelled';
  bulkUpload.updatedAt = new Date();
  await bulkUpload.save();

  res.status(200).json({
    success: true,
    data: { success: true },
    message: 'Bulk order upload cancelled successfully'
  });
});

// Get upload history
export const getUploadHistory = catchAsync(async (req, res, next) => {
  const sellerId = req.user.id;

  const uploads = await BulkOrderUpload.find({ sellerId })
    .sort({ uploadedAt: -1 })
    .limit(50);

  const history = uploads.map(upload => ({
    id: upload._id,
    uploadDate: upload.uploadedAt.toISOString().split('T')[0],
    originalFile: upload.originalFileName,
    successCount: upload.processedRows - upload.failedRows,
    errorCount: upload.failedRows,
    blankCount: 0, // Can be calculated if needed
    totalCount: upload.totalRows,
    errorFile: upload.failedRows > 0 ? `error_${upload._id}.xlsx` : '-',
    showHide: 'Show Details'
  }));

  res.status(200).json({
    success: true,
    data: history
  });
});

// Download error file
export const downloadErrorFile = catchAsync(async (req, res, next) => {
  const { uploadId } = req.params;
  const sellerId = req.user.id;

  const bulkUpload = await BulkOrderUpload.findOne({
    _id: uploadId,
    sellerId
  });

  if (!bulkUpload) {
    return next(new AppError('Upload not found', 404));
  }

  if (bulkUpload.uploadErrors.length === 0) {
    return next(new AppError('No errors found for this upload', 404));
  }

  // Create error Excel file
  const errorData = [
    ['Row', 'Order ID', 'Error Message'],
    ...bulkUpload.uploadErrors.map(error => [error.row, error.orderId || 'N/A', error.message])
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(errorData);
  XLSX.utils.book_append_sheet(wb, ws, 'Errors');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=error_${uploadId}.xlsx`);
  res.send(buffer);
});

// Toggle upload details visibility
export const toggleUploadDetails = catchAsync(async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: 'Details toggled successfully'
  });
});

// Download template
export const downloadTemplate = catchAsync(async (req, res, next) => {
  // Create template Excel file
  const headers = [
    'Order Id *',
    'Payment Type *',
    'Order Date *',
    'Shipping Full Name *',
    'Shipping Company Name',
    'Shipping Address Line1 *',
    'Shipping Address Line2 *',
    'Shipping Contact Number *',
    'Shipping City *',
    'Shipping Pincode *',
    'Billing Full Name',
    'Billing Company Name',
    'Billing Address1',
    'Billing Address2',
    'Billing City',
    'Billing Pincode',
    'Billing GST',
    'Package Weight *',
    'Package Length *',
    'Package Height *',
    'Package Width *',
    'Purchase Amount *',
    'SKU1',
    'Product Name1 *',
    'Quantity1 *',
    'Item Weight1 *',
    'Item Price1 *',
    'SKU2',
    'Product Name2',
    'Quantity2',
    'Item Weight2',
    'Item Price2',
    'SKU3',
    'Product Name3',
    'Quantity3',
    'Item Weight3',
    'Item Price3',
    'SKU4',
    'Product Name4',
    'Quantity4',
    'Item Weight4',
    'Item Price4'
  ];

  const sampleData = [
    'NT0075',
    'COD',
    '2022/07/20',
    'Sangeeta Singh',
    'Test Company',
    'Shipping address - 1',
    'Shipping address - 2',
    '8989898989',
    'New Delhi',
    '110062',
    'Test',
    'Test Company',
    'Test Billing address - 1',
    'Test Billing address - 2',
    'New Delhi',
    '122001',
    '22AAAAA0000A1Z5',
    '0.5',
    '10',
    '10',
    '10',
    '1000',
    'DLR_RED',
    'T-shirt - 32 Red',
    '1',
    '0.5',
    '230',
    'DLR_GRN',
    'T-shirt - 32 Green',
    '1',
    '0.5',
    '100',
    'DLR_BLU',
    'T-shirt - 32 Blue',
    '3',
    '1.5',
    '290',
    'DLR_YLO',
    'T-shirt - 32 Yellow',
    '10',
    '0.5',
    '100'
  ];

  const templateData = [headers, sampleData];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(templateData);

  // Set column widths
  const colWidths = headers.map(() => ({ wch: 20 }));
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Bulk Order Template');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=bulk_order_template.xlsx');
  res.send(buffer);
});

// Background processing function
async function processOrdersInBackground(uploadId, headers, rows, sellerId) {
  try {
    const bulkUpload = await BulkOrderUpload.findById(uploadId);
    if (!bulkUpload) return;

    let processedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      let rowData = {}; // Declare outside try block
      try {
        headers.forEach((header, index) => {
          rowData[header] = rows[i][index];
        });

        // Validate required fields
        const requiredFields = [
          'Order Id *',
          'Payment Type *',
          'Order Date *',
          'Shipping Full Name *',
          'Shipping Address Line1 *',
          'Shipping Address Line2 *',
          'Shipping Contact Number *',
          'Shipping City *',
          'Shipping Pincode *',
          'Package Weight *',
          'Product Name1 *',
          'Quantity1 *',
          'Item Weight1 *',
          'Item Price1 *',
          'Package Length *',
          'Package Width *',
          'Package Height *',
          'Purchase Amount *'
        ];
        const missingFields = requiredFields.filter(field => !rowData[field]);

        if (missingFields.length > 0) {
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Validate data types and format
        const quantity = parseInt(rowData['Quantity1 *']);
        const price = parseFloat(rowData['Item Price1 *']);
        const weight = parseFloat(rowData['Item Weight1 *']);
        const packageWeight = parseFloat(rowData['Package Weight *']);
        const length = parseFloat(rowData['Package Length *']);
        const width = parseFloat(rowData['Package Width *']);
        const height = parseFloat(rowData['Package Height *']);
        const amount = parseFloat(rowData['Purchase Amount *']);

        if (isNaN(quantity) || quantity <= 0) {
          throw new Error('Invalid quantity value');
        }
        if (isNaN(price) || price < 0) {
          throw new Error('Invalid price value');
        }
        if (isNaN(weight) || weight <= 0) {
          throw new Error('Invalid weight value');
        }
        if (isNaN(packageWeight) || packageWeight <= 0) {
          throw new Error('Invalid package weight value');
        }
        if (isNaN(amount) || amount < 0) {
          throw new Error('Invalid purchase amount value');
        }

        // Validate phone number format
        const phone = rowData['Shipping Contact Number *'].toString().trim();
        if (!/^[0-9]{10}$/.test(phone)) {
          throw new Error('Phone number must be 10 digits');
        }

        // Validate pincode format
        const pincode = rowData['Shipping Pincode *'].toString().trim();
        if (!/^[0-9]{6}$/.test(pincode)) {
          throw new Error('Pincode must be 6 digits');
        }

        // Derive state from city or provide default
        const city = rowData['Shipping City *'] || '';
        let state = '';

        // Simple state mapping based on common cities
        const cityStateMap = {
          'delhi': 'Delhi',
          'new delhi': 'Delhi',
          'mumbai': 'Maharashtra',
          'bangalore': 'Karnataka',
          'bengaluru': 'Karnataka',
          'chennai': 'Tamil Nadu',
          'kolkata': 'West Bengal',
          'hyderabad': 'Telangana',
          'pune': 'Maharashtra',
          'ahmedabad': 'Gujarat',
          'jaipur': 'Rajasthan'
        };

        state = cityStateMap[city.toLowerCase()] || city || 'Unknown';

        // Check if order with this orderId already exists
        const existingOrder = await Order.findOne({ orderId: rowData['Order Id *'] });
        if (existingOrder) {
          // Skip duplicate order and log as warning
          logger.warn(`Order ${rowData['Order Id *']} already exists, skipping...`);
          processedCount++;
          skippedCount++;
          continue;
        }

        // Create order
        const orderData = {
          seller: sellerId,
          orderId: rowData['Order Id *'],
          orderDate: new Date(rowData['Order Date *'] || new Date()),
          customer: {
            name: rowData['Shipping Full Name *'],
            phone: phone,
            email: rowData['Shipping Email'] || '',
            address: {
              street: `${rowData['Shipping Address Line1 *'] || ''} ${rowData['Shipping Address Line2 *'] || ''}`.trim(),
              city: city,
              state: state,
              pincode: pincode,
              country: 'India'
            }
          },
          product: {
            name: rowData['Product Name1 *'] || 'Bulk Order Item',
            sku: rowData['SKU1'] || '',
            quantity: quantity,
            price: price,
            weight: weight.toString(),
            dimensions: {
              length: length || 10,
              width: width || 10,
              height: height || 10
            }
          },
          payment: {
            method: rowData['Payment Type *'] === 'COD' ? 'COD' : 'Prepaid',
            amount: amount.toString(),
            total: amount.toString()
          },
          channel: 'EXCEL',
          status: 'Pending'
        };

        const order = new Order(orderData);
        await order.save();

        processedCount++;
        logger.info(`Successfully processed order: ${rowData['Order Id *']}`);
      } catch (error) {
        failedCount++;
        const errorMessage = error.message || 'Unknown error occurred';
        errors.push({
          row: i + 2, // +2 because we skip header and array is 0-indexed
          orderId: rowData['Order Id *'] || 'N/A',
          message: errorMessage
        });
        logger.error(`Error processing row ${i + 2}: ${errorMessage}`, error);
      }

      // Update progress
      bulkUpload.processedRows = processedCount;
      bulkUpload.failedRows = failedCount;
      bulkUpload.uploadErrors = errors;
      await bulkUpload.save();
    }

    // Mark as completed
    bulkUpload.status = 'Completed';
    bulkUpload.updatedAt = new Date();
    await bulkUpload.save();

    logger.info(`Bulk order processing completed: ${processedCount} success, ${failedCount} failed, ${skippedCount} skipped`);

  } catch (error) {
    logger.error('Error in background processing:', error);

    // Mark as failed
    const bulkUpload = await BulkOrderUpload.findById(uploadId);
    if (bulkUpload) {
      bulkUpload.status = 'Failed';
      bulkUpload.updatedAt = new Date();
      await bulkUpload.save();
    }
  }
}

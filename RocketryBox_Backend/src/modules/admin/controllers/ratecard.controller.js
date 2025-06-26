import xlsx from 'xlsx';
import { AppError } from '../../../middleware/errorHandler.js';
import RateCard from '../../../models/ratecard.model.js';
import rateCardService from '../../../services/ratecard.service.js';
import { logger } from '../../../utils/logger.js';

/**
 * Get all rate cards with filters and pagination
 * @route GET /api/v2/admin/ratecards
 * @access Private (Admin only)
 */
export const getAllRateCards = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      courier,
      zone,
      mode,
      isActive = true
    } = req.query;

    // Build filter object
    const filters = { isActive: isActive === 'true' };
    if (courier) filters.courier = courier;
    if (zone) filters.zone = zone;
    if (mode) filters.mode = mode;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get rate cards with pagination
    const rateCards = await RateCard.find(filters)
      .sort({ courier: 1, zone: 1, mode: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const totalCount = await RateCard.countDocuments(filters);

    // Get statistics
    const statsResult = await rateCardService.getStatistics();
    const statistics = statsResult.success ? statsResult.statistics : null;

    res.status(200).json({
      success: true,
      data: {
        rateCards,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalResults: totalCount
        },
        statistics,
        filters
      }
    });
  } catch (error) {
    logger.error(`Error in getAllRateCards: ${error.message}`);
    next(new AppError('Failed to fetch rate cards', 500));
  }
};

/**
 * Get rate card by ID
 * @route GET /api/v2/admin/ratecards/:id
 * @access Private (Admin only)
 */
export const getRateCardById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const rateCard = await RateCard.findById(id);

    if (!rateCard) {
      return next(new AppError('Rate card not found', 404));
    }

    res.status(200).json({
      success: true,
      data: {
        rateCard
      }
    });
  } catch (error) {
    logger.error(`Error in getRateCardById: ${error.message}`);
    next(new AppError('Failed to fetch rate card', 500));
  }
};

/**
 * Create new rate cards (bulk)
 * @route POST /api/v2/admin/ratecards
 * @access Private (Admin only)
 */
export const createRateCards = async (req, res, next) => {
  try {
    const { rateCards } = req.body;

    if (!Array.isArray(rateCards)) {
      return next(new AppError('Rate cards must be an array', 400));
    }

    const createdRateCards = [];
    const updatedRateCards = [];
    const errors = [];

    // Process each rate card
    for (const rateCardData of rateCards) {
      try {
        const result = await rateCardService.createOrUpdateRateCard(rateCardData);

        if (result.success) {
          if (result.isNew) {
            createdRateCards.push(result.rateCard);
          } else {
            updatedRateCards.push(result.rateCard);
          }
        } else {
          errors.push(result.error);
        }
      } catch (cardError) {
        errors.push(`Error processing rate card: ${cardError.message}`);
      }
    }

    // Log the operation
    logger.info(`Admin ${req.user.id} processed ${rateCards.length} rate cards: ${createdRateCards.length} created, ${updatedRateCards.length} updated, ${errors.length} errors`);

    res.status(200).json({
      success: true,
      data: {
        created: createdRateCards,
        updated: updatedRateCards,
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          totalProcessed: rateCards.length,
          created: createdRateCards.length,
          updated: updatedRateCards.length,
          failed: errors.length
        }
      }
    });
  } catch (error) {
    logger.error(`Error in createRateCards: ${error.message}`);
    next(new AppError('Failed to create rate cards', 500));
  }
};

/**
 * Update rate card by ID
 * @route PATCH /api/v2/admin/ratecards/:id
 * @access Private (Admin only)
 */
export const updateRateCard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const rateCard = await RateCard.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!rateCard) {
      return next(new AppError('Rate card not found', 404));
    }

    logger.info(`Admin ${req.user.id} updated rate card ${id}`);

    res.status(200).json({
      success: true,
      data: {
        rateCard
      }
    });
  } catch (error) {
    logger.error(`Error in updateRateCard: ${error.message}`);
    next(new AppError('Failed to update rate card', 500));
  }
};

/**
 * Deactivate rate card
 * @route PATCH /api/v2/admin/ratecards/:id/deactivate
 * @access Private (Admin only)
 */
export const deactivateRateCard = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await rateCardService.deactivateRateCard(id);

    if (!result.success) {
      return next(new AppError(result.error, 404));
    }

    logger.info(`Admin ${req.user.id} deactivated rate card ${id}`);

    res.status(200).json({
      success: true,
      data: {
        rateCard: result.rateCard
      },
      message: 'Rate card deactivated successfully'
    });
  } catch (error) {
    logger.error(`Error in deactivateRateCard: ${error.message}`);
    next(new AppError('Failed to deactivate rate card', 500));
  }
};

/**
 * Delete rate card (permanent)
 * @route DELETE /api/v2/admin/ratecards/:id
 * @access Private (Admin only - SuperAdmin)
 */
export const deleteRateCard = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user is superAdmin
    if (!req.user.isSuperAdmin) {
      return next(new AppError('Only super administrators can delete rate cards', 403));
    }

    const rateCard = await RateCard.findByIdAndDelete(id);

    if (!rateCard) {
      return next(new AppError('Rate card not found', 404));
    }

    logger.info(`SuperAdmin ${req.user.id} deleted rate card ${id}`);

    res.status(200).json({
      success: true,
      message: 'Rate card deleted successfully'
    });
  } catch (error) {
    logger.error(`Error in deleteRateCard: ${error.message}`);
    next(new AppError('Failed to delete rate card', 500));
  }
};

/**
 * Get rate card statistics
 * @route GET /api/v2/admin/ratecards/statistics
 * @access Private (Admin only)
 */
export const getRateCardStatistics = async (req, res, next) => {
  try {
    const result = await rateCardService.getStatistics();

    if (!result.success) {
      return next(new AppError(result.error, 500));
    }

    res.status(200).json({
      success: true,
      data: result.statistics
    });
  } catch (error) {
    logger.error(`Error in getRateCardStatistics: ${error.message}`);
    next(new AppError('Failed to fetch statistics', 500));
  }
};

/**
 * Get active couriers
 * @route GET /api/v2/admin/ratecards/couriers
 * @access Private (Admin only)
 */
export const getActiveCouriers = async (req, res, next) => {
  try {
    const result = await rateCardService.getActiveCouriers();

    if (!result.success) {
      return next(new AppError(result.error, 500));
    }

    res.status(200).json({
      success: true,
      data: {
        couriers: result.couriers
      }
    });
  } catch (error) {
    logger.error(`Error in getActiveCouriers: ${error.message}`);
    next(new AppError('Failed to fetch couriers', 500));
  }
};

/**
 * Import rate cards from JSON (for data migration)
 * @route POST /api/v2/admin/ratecards/import
 * @access Private (Admin only - SuperAdmin)
 */
export const importRateCards = async (req, res, next) => {
  try {
    const { rateCards, clearExisting = false } = req.body;

    // Check if user is superAdmin
    if (!req.user.isSuperAdmin) {
      return next(new AppError('Only super administrators can import rate cards', 403));
    }

    if (!Array.isArray(rateCards)) {
      return next(new AppError('Rate cards must be an array', 400));
    }

    // Clear existing data if requested
    if (clearExisting) {
      await RateCard.deleteMany({});
      logger.info(`SuperAdmin ${req.user.id} cleared existing rate cards before import`);
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Import each rate card
    for (const rateCardData of rateCards) {
      try {
        const newRateCard = new RateCard(rateCardData);
        await newRateCard.save();
        results.push({ success: true, data: newRateCard });
        successCount++;
      } catch (error) {
        results.push({ success: false, error: error.message, data: rateCardData });
        errorCount++;
      }
    }

    logger.info(`SuperAdmin ${req.user.id} imported rate cards: ${successCount} success, ${errorCount} errors`);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalProcessed: rateCards.length,
          successful: successCount,
          failed: errorCount,
          clearedExisting: clearExisting
        },
        results: results.slice(0, 10) // Show first 10 results only
      },
      message: `Import completed: ${successCount} rate cards imported successfully`
    });
  } catch (error) {
    logger.error(`Error in importRateCards: ${error.message}`);
    next(new AppError('Failed to import rate cards', 500));
  }
};

/**
 * Upload and process Excel file for rate cards
 * @route POST /api/v2/admin/ratecards/upload
 * @access Private (Admin only)
 */
export const uploadRateCardsExcel = async (req, res, next) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return next(new AppError('Please upload an Excel file', 400));
    }

    // Check file type
    const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return next(new AppError('Please upload a valid Excel file (.xlsx or .xls)', 400));
    }

    // Parse Excel file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet);

    if (!rawData || rawData.length === 0) {
      return next(new AppError('Excel file is empty or invalid', 400));
    }

    // Expected Excel columns (flexible mapping)
    const columnMappings = {
      'courier': ['courier', 'Courier', 'COURIER', 'courier_name', 'Courier Name'],
      'productName': ['productName', 'product_name', 'Product Name', 'Product', 'Service Type', 'service_type'],
      'mode': ['mode', 'Mode', 'MODE', 'delivery_mode', 'Delivery Mode'],
      'zone': ['zone', 'Zone', 'ZONE', 'delivery_zone', 'Delivery Zone'],
      'rateBand': ['rateBand', 'rate_band', 'Rate Band', 'RateBand', 'RATE_BAND', 'rate_plan', 'Rate Plan'],
      'baseRate': ['baseRate', 'base_rate', 'Base Rate', 'First KG', 'first_kg', 'base_price'],
      'addlRate': ['addlRate', 'addl_rate', 'Additional Rate', 'Additional KG', 'additional_kg', 'addl_price'],
      'codAmount': ['codAmount', 'cod_amount', 'COD Amount', 'COD Charges', 'cod_charges'],
      'codPercent': ['codPercent', 'cod_percent', 'COD Percent', 'COD %', 'cod_percentage'],
      'rtoCharges': ['rtoCharges', 'rto_charges', 'RTO Charges', 'RTO', 'return_charges'],
      'minimumBillableWeight': ['minimumBillableWeight', 'minimum_weight', 'Min Weight', 'Minimum Billable Weight']
    };

    // Function to find column value with flexible mapping
    const getColumnValue = (row, field) => {
      const possibleColumns = columnMappings[field] || [field];
      for (const col of possibleColumns) {
        if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
          return row[col];
        }
      }
      return null;
    };

    // Process and validate data
    const processedRateCards = [];
    const errors = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNumber = i + 2; // Excel row number (1-based + header)

      try {
        // Extract data with flexible column mapping
        const rateCardData = {
          courier: getColumnValue(row, 'courier'),
          productName: getColumnValue(row, 'productName'),
          mode: getColumnValue(row, 'mode'),
          zone: getColumnValue(row, 'zone'),
          rateBand: getColumnValue(row, 'rateBand') || 'RBX1', // Default to RBX1 if not specified
          baseRate: parseFloat(getColumnValue(row, 'baseRate') || 0),
          addlRate: parseFloat(getColumnValue(row, 'addlRate') || 0),
          codAmount: parseFloat(getColumnValue(row, 'codAmount') || 0),
          codPercent: parseFloat(getColumnValue(row, 'codPercent') || 0),
          rtoCharges: parseFloat(getColumnValue(row, 'rtoCharges') || 0),
          minimumBillableWeight: parseFloat(getColumnValue(row, 'minimumBillableWeight') || 0.5),
          isActive: true
        };

        // Validate required fields
        const requiredFields = ['courier', 'productName', 'mode', 'zone', 'baseRate', 'addlRate'];
        const missingFields = requiredFields.filter(field => !rateCardData[field]);

        if (missingFields.length > 0) {
          errors.push({
            row: rowNumber,
            error: `Missing required fields: ${missingFields.join(', ')}`,
            data: rateCardData
          });
          continue;
        }

        // Validate enum values
        const validModes = ['Surface', 'Air', 'Express', 'Standard', 'Premium'];
        const validZones = ['Within City', 'Within State', 'Within Region', 'Metro to Metro', 'Rest of India', 'Special Zone', 'North East & Special Areas'];
        // Remove fixed rate bands to allow custom naming
        const validRateBands = []; // Allow any rate band name

        if (!validModes.includes(rateCardData.mode)) {
          errors.push({
            row: rowNumber,
            error: `Invalid mode '${rateCardData.mode}'. Valid modes: ${validModes.join(', ')}`,
            data: rateCardData
          });
          continue;
        }

        if (!validZones.includes(rateCardData.zone)) {
          errors.push({
            row: rowNumber,
            error: `Invalid zone '${rateCardData.zone}'. Valid zones: ${validZones.join(', ')}`,
            data: rateCardData
          });
          continue;
        }

        // Validate rate band (optional validation - defaults to RBX1 if invalid)
        if (rateCardData.rateBand && !validRateBands.includes(rateCardData.rateBand)) {
          // Log warning but don't fail - just default to RBX1
          logger.warn(`Invalid rate band '${rateCardData.rateBand}' in row ${rowNumber}, defaulting to RBX1`);
          rateCardData.rateBand = 'RBX1';
        }

        // Validate numeric values
        if (isNaN(rateCardData.baseRate) || rateCardData.baseRate < 0) {
          errors.push({
            row: rowNumber,
            error: 'Invalid base rate. Must be a positive number',
            data: rateCardData
          });
          continue;
        }

        if (isNaN(rateCardData.addlRate) || rateCardData.addlRate < 0) {
          errors.push({
            row: rowNumber,
            error: 'Invalid additional rate. Must be a positive number',
            data: rateCardData
          });
          continue;
        }

        processedRateCards.push(rateCardData);

      } catch (rowError) {
        errors.push({
          row: rowNumber,
          error: `Processing error: ${rowError.message}`,
          data: row
        });
      }
    }

    // If too many errors, reject the upload
    if (errors.length > rawData.length * 0.5) {
      return next(new AppError(`Too many errors in Excel file (${errors.length}/${rawData.length}). Please check your data format.`, 400));
    }

    // Save processed rate cards
    const results = [];
    let successCount = 0;
    let updateCount = 0;
    const saveErrors = [];

    for (const rateCardData of processedRateCards) {
      try {
        // Check if rate card already exists (including rate band for uniqueness)
        const existingRateCard = await RateCard.findOne({
          courier: rateCardData.courier,
          productName: rateCardData.productName,
          mode: rateCardData.mode,
          zone: rateCardData.zone,
          rateBand: rateCardData.rateBand
        });

        if (existingRateCard) {
          // Update existing rate card
          Object.assign(existingRateCard, rateCardData);
          await existingRateCard.save();
          results.push({ action: 'updated', data: existingRateCard });
          updateCount++;
        } else {
          // Create new rate card
          const newRateCard = new RateCard(rateCardData);
          await newRateCard.save();
          results.push({ action: 'created', data: newRateCard });
          successCount++;
        }
      } catch (saveError) {
        saveErrors.push({
          data: rateCardData,
          error: saveError.message
        });
      }
    }

    // Log the operation
    logger.info(`Admin ${req.user.id} uploaded Excel file with rate cards: ${successCount} created, ${updateCount} updated, ${errors.length + saveErrors.length} errors`);

    // Prepare response
    const summary = {
      totalRows: rawData.length,
      processedRows: processedRateCards.length,
      created: successCount,
      updated: updateCount,
      errors: errors.length + saveErrors.length,
      successRate: `${Math.round(((successCount + updateCount) / rawData.length) * 100)}%`
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        results: results.slice(0, 10), // Show first 10 results
        processingErrors: errors.slice(0, 10), // Show first 10 processing errors
        saveErrors: saveErrors.slice(0, 10), // Show first 10 save errors
        message: `Successfully processed ${successCount + updateCount} rate cards out of ${rawData.length} rows`
      }
    });

  } catch (error) {
    logger.error(`Error in uploadRateCardsExcel: ${error.message}`);
    next(new AppError('Failed to process Excel file', 500));
  }
};

/**
 * Download rate card template
 * @route GET /api/v2/admin/ratecards/template
 * @access Private (Admin only)
 */
export const downloadRateCardTemplate = async (req, res, next) => {
  try {
    // Create template data
    const templateData = [
      {
        'Courier': 'Delhivery',
        'Product Name': 'Surface Delivery',
        'Mode': 'Surface',
        'Zone': 'Within City',
        'Rate Band': 'RBX1',
        'Base Rate': 40,
        'Additional Rate': 15,
        'COD Amount': 20,
        'COD Percent': 2,
        'RTO Charges': 30,
        'Minimum Billable Weight': 0.5
      },
      {
        'Courier': 'BlueDart',
        'Product Name': 'Express Delivery',
        'Mode': 'Air',
        'Zone': 'Metro to Metro',
        'Rate Band': 'RBX1',
        'Base Rate': 60,
        'Additional Rate': 25,
        'COD Amount': 35,
        'COD Percent': 2.5,
        'RTO Charges': 40,
        'Minimum Billable Weight': 0.5
      },
      {
        'Courier': 'XpressBees',
        'Product Name': 'B2C Standard',
        'Mode': 'Standard',
        'Zone': 'Within State',
        'Rate Band': 'RBX1',
        'Base Rate': 35,
        'Additional Rate': 12,
        'COD Amount': 25,
        'COD Percent': 2,
        'RTO Charges': 35,
        'Minimum Billable Weight': 0.5
      }
    ];

    // Create workbook
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(templateData);

    // Set column widths
    ws['!cols'] = [
      { width: 15 }, // Courier
      { width: 20 }, // Product Name
      { width: 12 }, // Mode
      { width: 20 }, // Zone
      { width: 12 }, // Rate Band
      { width: 12 }, // Base Rate
      { width: 15 }, // Additional Rate
      { width: 12 }, // COD Amount
      { width: 12 }, // COD Percent
      { width: 12 }, // RTO Charges
      { width: 20 }  // Minimum Billable Weight
    ];

    xlsx.utils.book_append_sheet(wb, ws, 'Rate Card Template');

    // Generate buffer
    const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=rate_card_template.xlsx');

    // Send file
    res.send(excelBuffer);

    logger.info(`Admin ${req.user.id} downloaded rate card template`);

  } catch (error) {
    logger.error(`Error in downloadRateCardTemplate: ${error.message}`);
    next(new AppError('Failed to generate template', 500));
  }
};

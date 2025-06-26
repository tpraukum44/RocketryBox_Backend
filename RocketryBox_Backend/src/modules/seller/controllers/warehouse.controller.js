import { AppError } from '../../../middleware/errorHandler.js';
import shippingPartnerRegistration from '../../../services/shippingPartnerRegistration.service.js';
import Seller from '../models/seller.model.js';
import StockHistory from '../models/stockHistory.model.js';
import Warehouse from '../models/warehouse.model.js';
import WarehouseItem from '../models/warehouseItem.model.js';

// List warehouses
export const listWarehouses = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = { seller: req.user.id, isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [warehouses, total] = await Promise.all([
      Warehouse.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Warehouse.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        warehouses,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Add new warehouse
export const addWarehouse = async (req, res, next) => {
  try {
    const { name, address, city, state, pincode, country, contactPerson, phone, email } = req.body;

    // Validate required fields
    if (!name || !address || !city || !state || !pincode) {
      throw new AppError('Name, address, city, state, and pincode are required', 400);
    }

    // Check if warehouse with same name already exists for this seller
    const existingWarehouse = await Warehouse.findOne({
      seller: req.user.id,
      name: name.trim(),
      isActive: true
    });

    if (existingWarehouse) {
      throw new AppError('Warehouse with this name already exists', 400);
    }

    const warehouse = new Warehouse({
      seller: req.user.id,
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      country: country || 'India',
      contactPerson: contactPerson?.trim(),
      phone: phone?.trim(),
      email: email?.trim()
    });

    await warehouse.save();

    // Get seller information for shipping partner registration
    const seller = await Seller.findById(req.user.id);

    // Auto-register warehouse with shipping partners (with better error handling)
    if (seller) {
      // Run in background - don't block the response
      setImmediate(async () => {
        try {
          console.log(`🏭 Auto-registering warehouse "${warehouse.name}" with shipping partners...`);

          // Add validation before registration
          const validation = shippingPartnerRegistration.validateWarehouseData(warehouse.toObject());
          if (!validation.isValid) {
            console.error(`❌ Warehouse validation failed:`, validation.errors);
            return;
          }

          const registrationResults = await shippingPartnerRegistration.registerWarehouseWithPartners(
            warehouse.toObject(),
            seller.toObject()
          );

          const report = shippingPartnerRegistration.generateRegistrationReport(registrationResults);
          console.log(report);

          if (registrationResults.summary.successfulRegistrations > 0) {
            console.log(`✅ Warehouse "${warehouse.name}" successfully registered with ${registrationResults.summary.successfulRegistrations} shipping partner(s)`);

            // Log successful registrations for debugging
            Object.entries(registrationResults.results).forEach(([partner, result]) => {
              if (result.success) {
                console.log(`   ✅ ${partner}: ${result.alias || result.message}`);
              }
            });
          } else {
            console.log(`⚠️ Warehouse "${warehouse.name}" registration failed with all shipping partners`);

            // Log detailed errors
            if (registrationResults.errors.length > 0) {
              console.log(`❌ Registration errors:`);
              registrationResults.errors.forEach(error => {
                console.log(`   • ${error}`);
              });
            }
          }

        } catch (error) {
          console.error(`❌ Error auto-registering warehouse "${warehouse.name}":`, error.message);
          console.error('Stack trace:', error.stack);
        }
      });
    }

    res.status(201).json({
      success: true,
      data: {
        warehouse,
        message: 'Warehouse created successfully. Registration with shipping partners is in progress.'
      }
    });
  } catch (error) {
    next(error);
  }
};

// List warehouse items
export const listWarehouseItems = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status, location } = req.query;
    const query = { seller: req.user.id };
    if (status) query.status = status;
    if (location) query.location = location;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
      WarehouseItem.find(query)
        .sort({ lastUpdated: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      WarehouseItem.countDocuments(query)
    ]);
    res.status(200).json({
      success: true,
      data: {
        items,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Add stock to item
export const addStockToItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { quantity, location, notes } = req.body;
    if (!quantity || isNaN(quantity) || quantity <= 0) {
      throw new AppError('Invalid quantity', 400);
    }
    const item = await WarehouseItem.findOne({ _id: itemId, seller: req.user.id });
    if (!item) throw new AppError('Item not found', 404);
    item.quantity += Number(quantity);
    item.location = location || item.location;
    item.lastUpdated = new Date();
    // Update status
    if (item.quantity <= 0) item.status = 'Out of Stock';
    else if (item.quantity < 5) item.status = 'Low Stock';
    else item.status = 'In Stock';
    await item.save();
    // Create stock history
    await StockHistory.create({
      item: item._id,
      seller: req.user.id,
      quantity,
      location: item.location,
      notes,
      type: 'add'
    });
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

// Register warehouse with shipping partners (manual trigger)
export const registerWarehouseWithPartners = async (req, res, next) => {
  try {
    const { warehouseId } = req.params;

    // Get warehouse details
    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      seller: req.user.id,
      isActive: true
    });

    if (!warehouse) {
      throw new AppError('Warehouse not found', 404);
    }

    // Get seller information
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      throw new AppError('Seller not found', 404);
    }

    console.log(`🔄 Manual registration triggered for warehouse "${warehouse.name}"`);

    // Register with shipping partners
    const registrationResults = await shippingPartnerRegistration.registerWarehouseWithPartners(
      warehouse.toObject(),
      seller.toObject()
    );

    const report = shippingPartnerRegistration.generateRegistrationReport(registrationResults);
    console.log(report);

    res.status(200).json({
      success: true,
      data: {
        warehouse: warehouse.name,
        registrationResults,
        summary: registrationResults.summary,
        message: registrationResults.summary.successfulRegistrations > 0
          ? `Successfully registered with ${registrationResults.summary.successfulRegistrations} shipping partner(s)`
          : 'Registration failed with all shipping partners'
      }
    });

  } catch (error) {
    next(error);
  }
};

// Check warehouse registration status with shipping partners
export const checkWarehouseRegistrationStatus = async (req, res, next) => {
  try {
    const { warehouseId } = req.params;

    // Get warehouse details
    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      seller: req.user.id,
      isActive: true
    });

    if (!warehouse) {
      throw new AppError('Warehouse not found', 404);
    }

    console.log(`🔍 Checking registration status for warehouse "${warehouse.name}"`);

    // Check existing registrations
    const registrationStatus = await shippingPartnerRegistration.checkExistingRegistrations(
      warehouse.toObject()
    );

    res.status(200).json({
      success: true,
      data: {
        warehouse: {
          id: warehouse._id,
          name: warehouse.name,
          address: warehouse.address,
          city: warehouse.city,
          state: warehouse.state,
          pincode: warehouse.pincode
        },
        registrationStatus
      }
    });

  } catch (error) {
    next(error);
  }
};

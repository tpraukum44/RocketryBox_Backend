import Store from '../models/store.model.js';
import { AppError } from '../../../middleware/errorHandler.js';

// List stores
export const listStores = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;
    const query = { seller: req.user.id };
    if (typeof isActive !== 'undefined') query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } },
        { pincode: { $regex: search, $options: 'i' } }
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [stores, total] = await Promise.all([
      Store.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Store.countDocuments(query)
    ]);
    res.status(200).json({
      success: true,
      data: {
        stores,
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

// Add store
export const addStore = async (req, res, next) => {
  try {
    const { name, address, city, state, pincode, contactPerson, phone, email, isActive } = req.body;
    const store = await Store.create({
      seller: req.user.id,
      name,
      address,
      city,
      state,
      pincode,
      contactPerson,
      phone,
      email,
      isActive
    });
    res.status(201).json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
};

// Get store details
export const getStore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const store = await Store.findOne({ _id: id, seller: req.user.id });
    if (!store) throw new AppError('Store not found', 404);
    res.status(200).json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
};

// Update store
export const updateStore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, address, city, state, pincode, contactPerson, phone, email, isActive } = req.body;
    const store = await Store.findOne({ _id: id, seller: req.user.id });
    if (!store) throw new AppError('Store not found', 404);
    if (name) store.name = name;
    if (address) store.address = address;
    if (city) store.city = city;
    if (state) store.state = state;
    if (pincode) store.pincode = pincode;
    if (contactPerson) store.contactPerson = contactPerson;
    if (phone) store.phone = phone;
    if (email) store.email = email;
    if (typeof isActive !== 'undefined') store.isActive = isActive;
    await store.save();
    res.status(200).json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
};

// Delete store
export const deleteStore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const store = await Store.findOneAndDelete({ _id: id, seller: req.user.id });
    if (!store) throw new AppError('Store not found', 404);
    res.status(200).json({ success: true, data: { message: 'Store deleted' } });
  } catch (error) {
    next(error);
  }
}; 
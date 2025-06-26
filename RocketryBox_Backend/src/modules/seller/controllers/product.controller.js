import Product from '../models/product.model.js';
import { AppError } from '../../../middleware/errorHandler.js';

// List products
export const listProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, category, status } = req.query;
    const query = { seller: req.user.id };
    if (category) query.category = category;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ lastUpdated: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(query)
    ]);
    res.status(200).json({
      success: true,
      data: {
        products,
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

// Add product
export const addProduct = async (req, res, next) => {
  try {
    const { name, sku, category, price, stock, status } = req.body;
    const exists = await Product.findOne({ seller: req.user.id, sku });
    if (exists) throw new AppError('SKU already exists', 409);
    const product = await Product.create({
      seller: req.user.id,
      name,
      sku,
      category,
      price,
      stock,
      status
    });
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// Get product details
export const getProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne({ _id: id, seller: req.user.id });
    if (!product) throw new AppError('Product not found', 404);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// Update product
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, sku, category, price, stock, status } = req.body;
    const product = await Product.findOne({ _id: id, seller: req.user.id });
    if (!product) throw new AppError('Product not found', 404);
    if (sku && sku !== product.sku) {
      const exists = await Product.findOne({ seller: req.user.id, sku });
      if (exists) throw new AppError('SKU already exists', 409);
      product.sku = sku;
    }
    if (name) product.name = name;
    if (category) product.category = category;
    if (typeof price !== 'undefined') product.price = price;
    if (typeof stock !== 'undefined') product.stock = stock;
    if (status) product.status = status;
    product.lastUpdated = new Date();
    await product.save();
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// Delete product
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findOneAndDelete({ _id: id, seller: req.user.id });
    if (!product) throw new AppError('Product not found', 404);
    res.status(200).json({ success: true, data: { message: 'Product deleted' } });
  } catch (error) {
    next(error);
  }
}; 
import Joi from 'joi';

export const addWarehouseSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  address: Joi.string().min(1).max(500).required(),
  city: Joi.string().min(1).max(100).required(),
  state: Joi.string().min(1).max(100).required(),
  pincode: Joi.string().pattern(/^\d{6}$/).required(),
  country: Joi.string().max(100).optional(),
  contactPerson: Joi.string().max(100).optional(),
  phone: Joi.string().pattern(/^[6-9]\d{9}$/).optional(),
  email: Joi.string().email().optional()
});

export const addStockSchema = Joi.object({
  quantity: Joi.number().integer().min(1).required(),
  location: Joi.string().required(),
  notes: Joi.string().allow('', null)
});

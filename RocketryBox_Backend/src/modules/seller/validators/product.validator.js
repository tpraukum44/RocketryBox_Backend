import Joi from 'joi';

export const addProductSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  sku: Joi.string().min(2).max(50).required(),
  category: Joi.string().allow('', null),
  price: Joi.number().min(0).required(),
  stock: Joi.number().integer().min(0).required(),
  status: Joi.string().valid('Active', 'Inactive').optional()
});

export const updateProductSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  sku: Joi.string().min(2).max(50),
  category: Joi.string().allow('', null),
  price: Joi.number().min(0),
  stock: Joi.number().integer().min(0),
  status: Joi.string().valid('Active', 'Inactive')
}); 
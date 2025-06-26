import Joi from 'joi';

export const addStoreSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  address: Joi.string().min(5).max(200).required(),
  city: Joi.string().min(2).max(100).required(),
  state: Joi.string().min(2).max(100).required(),
  pincode: Joi.string().pattern(/^[0-9]{6}$/).required(),
  contactPerson: Joi.string().allow('', null),
  phone: Joi.string().allow('', null),
  email: Joi.string().email().allow('', null),
  isActive: Joi.boolean().optional()
});

export const updateStoreSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  address: Joi.string().min(5).max(200),
  city: Joi.string().min(2).max(100),
  state: Joi.string().min(2).max(100),
  pincode: Joi.string().pattern(/^[0-9]{6}$/),
  contactPerson: Joi.string().allow('', null),
  phone: Joi.string().allow('', null),
  email: Joi.string().email().allow('', null),
  isActive: Joi.boolean()
}); 
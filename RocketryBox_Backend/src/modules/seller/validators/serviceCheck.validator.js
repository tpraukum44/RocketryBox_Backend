import Joi from 'joi';

export const bulkServiceCheckSchema = Joi.object({
  pincodes: Joi.array().items(Joi.string().pattern(/^[0-9]{6}$/)).min(1).required()
});

export const getServiceRestrictionsSchema = Joi.object({
  pincode: Joi.string().pattern(/^[0-9]{6}$/).required(),
  serviceType: Joi.string().valid('standard', 'express', 'cod').required()
}); 
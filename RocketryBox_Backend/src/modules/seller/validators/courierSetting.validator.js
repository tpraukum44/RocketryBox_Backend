import Joi from 'joi';

export const courierSettingSchema = Joi.object({
  courierName: Joi.string().min(2).max(100).required(),
  accountId: Joi.string().allow('', null),
  apiKey: Joi.string().allow('', null),
  apiSecret: Joi.string().allow('', null),
  pickupLocation: Joi.string().allow('', null),
  serviceablePincodes: Joi.array().items(Joi.string().pattern(/^[0-9]{6}$/)).optional(),
  maxWeight: Joi.number().min(0).optional(),
  maxValue: Joi.number().min(0).optional(),
  isActive: Joi.boolean().optional()
}); 
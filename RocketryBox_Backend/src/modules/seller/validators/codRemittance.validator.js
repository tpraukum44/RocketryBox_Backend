import Joi from 'joi';

export const createCODRemittanceSchema = Joi.object({
  seller: Joi.string().required(),
  remittanceAmount: Joi.number().min(0).required(),
  freightDeduction: Joi.number().min(0).default(0),
  convenienceFee: Joi.number().min(0).default(0),
  total: Joi.number().min(0).required(),
  paymentDate: Joi.date().optional(),
  paymentRef: Joi.string().allow('', null),
  status: Joi.string().valid('Pending', 'Completed', 'Failed', 'Overdue').optional(),
  remarks: Joi.string().allow('', null)
});

export const updateCODRemittanceSchema = Joi.object({
  status: Joi.string().valid('Pending', 'Completed', 'Failed', 'Overdue').optional(),
  paymentDate: Joi.date().optional(),
  paymentRef: Joi.string().allow('', null),
  remarks: Joi.string().allow('', null)
}); 
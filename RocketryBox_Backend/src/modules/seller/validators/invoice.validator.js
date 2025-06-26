import Joi from 'joi';

const invoiceItemSchema = Joi.object({
  description: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  unitPrice: Joi.number().min(0).required()
});

export const createInvoiceSchema = Joi.object({
  items: Joi.array().items(invoiceItemSchema).min(1).required(),
  dueDate: Joi.date().min('now').required(),
  tax: Joi.number().min(0).default(0),
  remarks: Joi.string().allow('')
});

export const updateInvoiceSchema = Joi.object({
  items: Joi.array().items(invoiceItemSchema).min(1),
  dueDate: Joi.date().min('now'),
  tax: Joi.number().min(0),
  remarks: Joi.string().allow(''),
  status: Joi.string().valid('draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded')
});

export const paymentVerificationSchema = Joi.object({
  paymentId: Joi.string().required(),
  orderId: Joi.string().required(),
  signature: Joi.string().required()
}); 
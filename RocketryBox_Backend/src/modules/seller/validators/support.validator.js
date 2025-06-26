import Joi from 'joi';

export const createTicketSchema = Joi.object({
  subject: Joi.string().min(3).max(200).required(),
  category: Joi.string().valid('ORDER', 'PICKUP', 'BILLING', 'REMITTANCE', 'WT_DISPUTE', 'TECH', 'CALLBACK', 'KYC', 'FINANCE').required(),
  priority: Joi.string().valid('Low', 'Medium', 'High', 'Urgent').default('Low'),
  message: Joi.string().min(5).required(),
  attachments: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      url: Joi.string().uri().required()
    })
  ).max(5)
});

export const addTicketResponseSchema = Joi.object({
  message: Joi.string().min(2).required(),
  attachments: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      url: Joi.string().uri().required()
    })
  ).max(5)
}); 
import Joi from 'joi';

export const reversalSchema = Joi.object({
  reason: Joi.string().required().min(10).max(500)
}); 
import Joi from 'joi';

export const updateWhatsAppSettingsSchema = Joi.object({
  apiKey: Joi.string().required(),
  apiSecret: Joi.string().required(),
  senderNumber: Joi.string().required(),
  templates: Joi.object().pattern(Joi.string(), Joi.string()),
  enabled: Joi.boolean().optional(),
});

export const enableWhatsAppSettingsSchema = Joi.object({
  enabled: Joi.boolean().required(),
}); 
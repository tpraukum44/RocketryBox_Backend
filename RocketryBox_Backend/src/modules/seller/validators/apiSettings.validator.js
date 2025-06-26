import Joi from 'joi';

export const updateAPIStatusSchema = Joi.object({
  status: Joi.string()
    .valid('active', 'inactive')
    .required()
    .messages({
      'any.required': 'Status is required',
      'string.base': 'Status must be a string',
      'any.only': 'Status must be either active or inactive'
    })
});

// For future use if we need to add more settings
export const updateAPISettingsSchema = Joi.object({
  status: Joi.string()
    .valid('active', 'inactive')
    .optional()
    .messages({
      'string.base': 'Status must be a string',
      'any.only': 'Status must be either active or inactive'
    })
}); 
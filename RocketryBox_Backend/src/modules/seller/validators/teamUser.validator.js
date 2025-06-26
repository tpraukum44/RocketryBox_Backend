import Joi from 'joi';

// Simple permissions schema - allows any key with boolean value
const permissionsSchema = Joi.object().pattern(
  Joi.string(),
  Joi.boolean()
).optional();

export const addTeamUserSchema = Joi.object({
  name: Joi.string()
    .required()
    .min(2)
    .max(50)
    .messages({
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 50 characters',
      'any.required': 'Name is required'
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email',
      'any.required': 'Email is required'
    }),
  phone: Joi.string()
    .pattern(/^[+]?[\s\-\(\)]?[\d\s\-\(\)]{10,15}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Phone number must be 10-15 digits and may include formatting'
    }),
  password: Joi.string()
    .min(6)
    .optional()
    .messages({
      'string.min': 'Password must be at least 6 characters long'
    }),
  role: Joi.string()
    .valid('Manager', 'Support', 'Finance')
    .default('Support')
    .messages({
      'any.only': 'Role must be one of: Manager, Support, Finance'
    }),
  permissions: permissionsSchema.optional()
});

export const updateTeamUserSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .messages({
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 50 characters'
    }),
  phone: Joi.string()
    .pattern(/^[+]?[\s\-\(\)]?[\d\s\-\(\)]{10,15}$/)
    .messages({
      'string.pattern.base': 'Phone number must be 10-15 digits and may include formatting'
    }),
  role: Joi.string()
    .valid('Manager', 'Support', 'Finance')
    .messages({
      'any.only': 'Role must be one of: Manager, Support, Finance'
    }),
  status: Joi.string()
    .valid('Active', 'Inactive')
    .messages({
      'any.only': 'Status must be either Active or Inactive'
    })
});

export const updatePermissionsSchema = Joi.object({
  permissions: permissionsSchema.required()
});

export const resetPasswordSchema = Joi.object({
  newPassword: Joi.string()
    .min(6)
    .optional()
    .messages({
      'string.min': 'Password must be at least 6 characters long'
    })
});

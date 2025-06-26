import { validationResult } from 'express-validator';
import { AppError } from './errorHandler.js';

// Accepts a Joi schema or an array of Joi schemas
export const validationHandler = (schemas) => {
  return async (req, res, next) => {
    try {
      // Handle both single schema and array of schemas
      const schemaArray = Array.isArray(schemas) ? schemas : [schemas];
      
      for (const schema of schemaArray) {
        // Transform data if needed (for registration)
        let dataToValidate = req.body;
        if (req.path === '/auth/register') {
          dataToValidate = {
            ...req.body,
            name: `${req.body.firstName} ${req.body.lastName}`.trim(),
            businessName: req.body.companyName
          };
        }

        // Validate the data
        const { error } = schema.validate(dataToValidate, { 
          abortEarly: false,
          allowUnknown: true, // Allow unknown keys
          stripUnknown: true // Remove unknown keys
        });

        if (error) {
          const errors = {};
          error.details.forEach((err) => {
            // Map the error fields back to frontend field names
            let field = err.path[err.path.length - 1];
            if (field === 'name') {
              // Split name error between firstName and lastName
              if (err.message.includes('required')) {
                errors.firstName = 'First name is required';
                errors.lastName = 'Last name is required';
              } else {
                errors.firstName = err.message.replace('name', 'first name');
                errors.lastName = err.message.replace('name', 'last name');
              }
            } else if (field === 'businessName') {
              errors.companyName = err.message.replace('businessName', 'company name');
            } else {
              errors[field] = err.message.replace(/['"]/g, '');
            }
          });

          return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors
          });
        }
      }
      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      next(new AppError('Validation failed', 400));
    }
  };
};

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const validationErrors = {};
    errors.array().forEach(error => {
      validationErrors[error.path] = error.msg;
    });
    
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: validationErrors
    });
  }
  next();
}; 
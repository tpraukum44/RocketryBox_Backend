import Joi from 'joi';

export const createNDRSchema = Joi.object({
  orderId: Joi.string().required(),
  awb: Joi.string().required(),
  shipmentId: Joi.string().required(),
  customer: Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().required(),
    email: Joi.string().email().required(),
    address: Joi.object({
      fullName: Joi.string().required(),
      contactNumber: Joi.string().required(),
      addressLine1: Joi.string().required(),
      addressLine2: Joi.string().allow('', null),
      landmark: Joi.string().allow('', null),
      pincode: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required()
    }).required()
  }).required(),
  seller: Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    contact: Joi.string().required()
  }).required(),
  courier: Joi.object({
    name: Joi.string().required(),
    trackingUrl: Joi.string().uri().allow('', null)
  }).required(),
  attempts: Joi.number().min(1).default(1),
  attemptHistory: Joi.array().items(
    Joi.object({
      date: Joi.string().required(),
      time: Joi.string().required(),
      status: Joi.string().required(),
      reason: Joi.string().allow('', null),
      agentRemarks: Joi.string().allow('', null)
    })
  ),
  status: Joi.string().valid('Pending', 'In Progress', 'Resolved', 'RTO Initiated').default('Pending'),
  reason: Joi.string().allow('', null),
  recommendedAction: Joi.string().allow('', null),
  currentLocation: Joi.object({
    lat: Joi.number(),
    lng: Joi.number()
  }),
  products: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      sku: Joi.string().required(),
      quantity: Joi.number().required(),
      price: Joi.number().required(),
      image: Joi.string().uri().allow('', null)
    })
  )
});

export const updateNDRStatusSchema = Joi.object({
  status: Joi.string().valid('Pending', 'In Progress', 'Resolved', 'RTO Initiated').required(),
  reason: Joi.string().allow('', null),
  recommendedAction: Joi.string().allow('', null),
  agentRemarks: Joi.string().allow('', null)
});

import { validationHandler as validateRequest } from '../../../middleware/validator.js';

export const validateCreateNDR = validateRequest(createNDRSchema);
export const validateUpdateNDRStatus = validateRequest(updateNDRStatusSchema); 
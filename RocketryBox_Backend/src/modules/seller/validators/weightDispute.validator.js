import Joi from 'joi';

export const updateWeightDisputeSchema = Joi.object({
  status: Joi.string().valid('Action Required', 'Open Dispute', 'Closed Dispute', 'Closed Resolved'),
  revised: Joi.number().min(0),
  accepted: Joi.boolean(),
  comments: Joi.string().allow('', null)
});

export const uploadWeightDisputeFileSchema = Joi.object({
  file: Joi.any().required()
}); 
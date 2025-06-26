import Joi from 'joi';

export const updateLabelSettingSchema = Joi.object({
  labelSize: Joi.string().valid('A4', 'A5', '4x6', 'A6'),
  format: Joi.string().valid('PDF', 'PNG', 'ZPL'),
  showLogo: Joi.boolean(),
  logoUrl: Joi.string().uri().allow('', null),
  showBarcode: Joi.boolean(),
  showReturnLabel: Joi.boolean(),
  additionalText: Joi.string().allow('', null)
}); 
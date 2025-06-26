import Joi from 'joi';

const addressSchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  pincode: Joi.string().required(),
  country: Joi.string().default('India')
});

const customerSchema = Joi.object({
  name: Joi.string().required(),
  phone: Joi.string().required(),
  email: Joi.string().email().required(),
  address: addressSchema.required()
});

const dimensionsSchema = Joi.object({
  length: Joi.number().required(),
  width: Joi.number().required(),
  height: Joi.number().required()
});

const productSchema = Joi.object({
  name: Joi.string().required(),
  sku: Joi.string().required(),
  quantity: Joi.number().required().min(1),
  price: Joi.number().required().min(0),
  weight: Joi.string().required(),
  dimensions: dimensionsSchema.required()
});

const paymentSchema = Joi.object({
  method: Joi.string().valid('COD', 'Prepaid').required(),
  amount: Joi.string().required(),
  codCharge: Joi.string().when('method', {
    is: 'COD',
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  }),
  shippingCharge: Joi.string().required(),
  gst: Joi.string().required(),
  total: Joi.string().required()
});

export const validateOrder = (data) => {
  const schema = Joi.object({
    orderId: Joi.string().required(),
    customer: customerSchema.required(),
    product: productSchema.required(),
    payment: paymentSchema.required(),
    channel: Joi.string().valid('MANUAL', 'EXCEL', 'SHOPIFY', 'WOOCOMMERCE', 'AMAZON', 'FLIPKART', 'OPENCART', 'API').default('MANUAL')
  });

  return schema.validate(data);
};

export const validateOrderStatus = (data) => {
  const schema = Joi.object({
    status: Joi.string().valid('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned').required()
  });

  return schema.validate(data);
};

export const validateBulkOrderStatus = (data) => {
  const schema = Joi.object({
    orderIds: Joi.array().items(Joi.string()).required(),
    status: Joi.string().valid('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned').required()
  });

  return schema.validate(data);
}; 
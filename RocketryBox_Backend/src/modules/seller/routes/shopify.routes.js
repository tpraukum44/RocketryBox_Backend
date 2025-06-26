import axios from 'axios';
import crypto from 'crypto';
import express from 'express';
import { authenticateSeller } from '../../../middleware/auth.js';
import { emitEvent, EVENT_TYPES } from '../../../utils/events.js';
import { getIO } from '../../../utils/socketio.js';
import SellerOrder from '../models/order.model.js';
import Seller from '../models/seller.model.js';

const router = express.Router();

// Environment variables for Shopify app
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

// OAuth callback route
router.get('/callback', async (req, res) => {
  try {
    const { code, shop, state } = req.query;

    if (!code || !shop) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: code and shop'
      });
    }

    // Extract seller ID from state parameter (you might want to implement this differently)
    // For now, we'll find the seller by shop domain
    let seller = await Seller.findOne({
      $or: [
        { 'storeLinks.shopify': shop },
        { 'shopifyIntegration.shop': shop }
      ]
    });

    // If seller not found by exact domain match, try to find any seller with this shop as partial match
    if (!seller) {
      // For development: find any seller and assume they want to connect this shop
      // In production, you might want to use state parameter to pass seller ID
      const sellersWithShopifyInProfile = await Seller.find({
        'storeLinks.shopify': { $exists: true, $ne: null }
      });

      if (sellersWithShopifyInProfile.length === 1) {
        seller = sellersWithShopifyInProfile[0];
      }
    }

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found for this shop. Please ensure you have entered the correct Shopify domain in your store settings.'
      });
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      code: code
    });

    const { access_token } = tokenResponse.data;

    // Construct webhook URL from request host
    const protocol = req.secure || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const host = req.get('host');
    const webhookUrl = `${protocol}://${host}/api/v2/seller/shopify/webhook/order`;

    // Register webhook for order creation
    const webhookResponse = await axios.post(
      `https://${shop}/admin/api/2024-01/webhooks.json`,
      {
        webhook: {
          topic: 'orders/create',
          address: webhookUrl,
          format: 'json'
        }
      },
      {
        headers: {
          'X-Shopify-Access-Token': access_token,
          'Content-Type': 'application/json'
        }
      }
    );

    const webhook = webhookResponse.data.webhook;

    // Update seller with Shopify integration details
    seller.shopifyIntegration = {
      shop: shop,
      accessToken: access_token,
      webhookId: webhook.id.toString(),
      isActive: true,
      connectedAt: new Date(),
      lastSync: new Date()
    };

    // Also update storeLinks.shopify
    if (!seller.storeLinks) {
      seller.storeLinks = {};
    }
    seller.storeLinks.shopify = shop;

    await seller.save();

    // Redirect to frontend success page
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/seller/dashboard/settings/manage-store?shopify=connected`);

  } catch (error) {
    console.error('Shopify OAuth callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to connect Shopify store',
      error: error.message
    });
  }
});

// Webhook verification middleware
const verifyShopifyWebhook = (req, res, next) => {
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  const body = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(body, 'utf8')
    .digest('base64');

  if (hash !== hmac) {
    return res.status(401).json({
      success: false,
      message: 'Webhook verification failed'
    });
  }

  next();
};

// Order creation webhook
router.post('/webhook/order', express.raw({ type: 'application/json' }), (req, res, next) => {
  // Parse JSON manually for webhook verification
  try {
    req.body = JSON.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload'
    });
  }
}, verifyShopifyWebhook, async (req, res) => {
  try {
    const orderData = req.body;
    const shopDomain = req.get('X-Shopify-Shop-Domain');

    // Find seller by shop domain
    const seller = await Seller.findOne({
      $or: [
        { 'shopifyIntegration.shop': shopDomain },
        { 'storeLinks.shopify': shopDomain }
      ]
    });

    if (!seller) {
      console.log(`No seller found for shop: ${shopDomain}`);
      return res.status(404).json({
        success: false,
        message: 'Seller not found for this shop'
      });
    }

    // Check if order already exists to prevent duplicates
    const existingOrder = await SellerOrder.findOne({
      seller: seller._id,
      orderId: `SHOPIFY_${orderData.id}`,
      channel: 'SHOPIFY'
    });

    if (existingOrder) {
      console.log(`Order already exists: SHOPIFY_${orderData.id}`);
      return res.status(200).json({
        success: true,
        message: 'Order already processed'
      });
    }

    // Extract shipping address
    const shippingAddress = orderData.shipping_address || orderData.billing_address;
    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: 'No shipping address found in order'
      });
    }

    // Calculate total weight from line items
    let totalWeight = 0;
    const products = orderData.line_items.map(item => {
      const weight = parseFloat(item.grams) || 0;
      totalWeight += weight * item.quantity;

      return {
        name: item.name,
        sku: item.sku || item.variant_id?.toString(),
        quantity: item.quantity,
        price: parseFloat(item.price),
        weight: weight.toString(),
        dimensions: {
          length: 0,
          width: 0,
          height: 0
        }
      };
    });

    // Create order object
    const newOrder = new SellerOrder({
      seller: seller._id,
      orderId: `SHOPIFY_${orderData.id}`,
      orderDate: new Date(orderData.created_at),
      customer: {
        name: `${orderData.customer.first_name} ${orderData.customer.last_name}`.trim(),
        phone: orderData.customer.phone || shippingAddress.phone,
        email: orderData.customer.email,
        address: {
          street: `${shippingAddress.address1} ${shippingAddress.address2 || ''}`.trim(),
          city: shippingAddress.city,
          state: shippingAddress.province,
          pincode: shippingAddress.zip,
          country: shippingAddress.country
        }
      },
      product: products[0] || {
        name: 'Shopify Order',
        sku: '',
        quantity: 1,
        price: parseFloat(orderData.total_price),
        weight: totalWeight.toString(),
        dimensions: { length: 0, width: 0, height: 0 }
      },
      payment: {
        method: orderData.gateway === 'cash_on_delivery' ? 'COD' : 'Prepaid',
        amount: orderData.subtotal_price,
        codCharge: '0',
        shippingCharge: orderData.total_shipping_price_set?.shop_money?.amount || '0',
        gst: orderData.total_tax,
        total: orderData.total_price
      },
      status: 'Created',
      channel: 'SHOPIFY',
      orderTimeline: [{
        status: 'Created',
        timestamp: new Date(),
        comment: 'Order imported from Shopify'
      }]
    });

    await newOrder.save();

    // Update seller's last sync time
    seller.shopifyIntegration.lastSync = new Date();
    await seller.save();

    console.log(`Order created successfully: SHOPIFY_${orderData.id}`);

    // Emit real-time events for immediate frontend updates
    try {
      const io = getIO();

      // Emit to seller-specific room for real-time dashboard updates
      io.to(`seller-${seller._id}`).emit('new-order', {
        orderId: newOrder.orderId,
        order: {
          orderId: newOrder.orderId,
          date: newOrder.orderDate.toISOString(),
          customer: newOrder.customer.name,
          contact: newOrder.customer.phone,
          items: [{
            name: newOrder.product.name,
            sku: newOrder.product.sku,
            quantity: newOrder.product.quantity,
            price: newOrder.product.price
          }],
          amount: newOrder.payment.total,
          payment: newOrder.payment.method,
          chanel: 'SHOPIFY',
          weight: newOrder.product.weight,
          tags: '',
          action: 'Ship',
          whatsapp: 'Message Delivered',
          status: 'not-booked',
          awbNumber: null,
          pincode: newOrder.customer.address.pincode
        },
        timestamp: new Date(),
        source: 'shopify'
      });

      // Emit general order event for system-wide listeners
      emitEvent(EVENT_TYPES.ORDER_CREATED, {
        orderId: newOrder.orderId,
        orderNumber: newOrder.orderId,
        sellerId: seller._id,
        channel: 'SHOPIFY',
        totalAmount: newOrder.payment.total,
        customer: newOrder.customer.name,
        source: 'shopify-webhook'
      });

      console.log(`Real-time events emitted for order: SHOPIFY_${orderData.id}`);
    } catch (socketError) {
      console.error('Failed to emit real-time events (order still created):', socketError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Order processed successfully',
      orderId: newOrder.orderId
    });

  } catch (error) {
    console.error('Shopify webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process order',
      error: error.message
    });
  }
});

// Get Shopify integration status
router.get('/status', authenticateSeller, async (req, res) => {
  try {
    const seller = await Seller.findById(req.seller.id);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    const shopifyIntegration = seller.shopifyIntegration || {};

    res.json({
      success: true,
      data: {
        isActive: shopifyIntegration.isActive || false,
        shop: shopifyIntegration.shop || null,
        connectedAt: shopifyIntegration.connectedAt || null,
        lastSync: shopifyIntegration.lastSync || null
      }
    });

  } catch (error) {
    console.error('Get Shopify status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get Shopify status',
      error: error.message
    });
  }
});

// Disconnect Shopify integration
router.post('/disconnect', authenticateSeller, async (req, res) => {
  try {
    const seller = await Seller.findById(req.seller.id);

    if (!seller || !seller.shopifyIntegration?.isActive) {
      return res.status(404).json({
        success: false,
        message: 'No active Shopify integration found'
      });
    }

    // Try to delete webhook if we have access token and webhook ID
    if (seller.shopifyIntegration.accessToken && seller.shopifyIntegration.webhookId) {
      try {
        await axios.delete(
          `https://${seller.shopifyIntegration.shop}/admin/api/2024-01/webhooks/${seller.shopifyIntegration.webhookId}.json`,
          {
            headers: {
              'X-Shopify-Access-Token': seller.shopifyIntegration.accessToken
            }
          }
        );
      } catch (webhookError) {
        console.log('Failed to delete webhook (continuing anyway):', webhookError.message);
      }
    }

    // Clear Shopify integration
    seller.shopifyIntegration = {
      shop: null,
      accessToken: null,
      webhookId: null,
      isActive: false,
      connectedAt: null,
      lastSync: null
    };

    await seller.save();

    res.json({
      success: true,
      message: 'Shopify integration disconnected successfully'
    });

  } catch (error) {
    console.error('Disconnect Shopify error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect Shopify integration',
      error: error.message
    });
  }
});

export default router;

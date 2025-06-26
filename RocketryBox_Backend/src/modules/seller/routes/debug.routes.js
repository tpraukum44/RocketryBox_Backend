import express from 'express';
import jwt from 'jsonwebtoken';
import Seller from '../models/seller.model.js';

const router = express.Router();

// Debug endpoint to check authentication details
router.get('/auth-debug', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Starting authentication debug...');

    // 1) Check if token exists
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    const debugInfo = {
      step1_token_check: {
        hasAuthHeader: !!req.headers.authorization,
        authHeaderValue: req.headers.authorization ? 'Bearer ***' : null,
        tokenExists: !!token,
        tokenLength: token ? token.length : 0
      }
    };

    if (!token) {
      debugInfo.error = 'No token provided';
      return res.json({ success: false, debug: debugInfo });
    }

    // 2) Try to decode token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      debugInfo.step2_token_decode = {
        success: true,
        id: decoded.id,
        role: decoded.role,
        email: decoded.email,
        isImpersonated: decoded.isImpersonated,
        impersonatedBy: decoded.impersonatedBy,
        exp: new Date(decoded.exp * 1000),
        isExpired: Date.now() >= decoded.exp * 1000
      };
    } catch (jwtError) {
      debugInfo.step2_token_decode = {
        success: false,
        error: jwtError.message,
        name: jwtError.name
      };
      return res.json({ success: false, debug: debugInfo });
    }

    // 3) Check role
    debugInfo.step3_role_check = {
      decodedRole: decoded.role,
      isSeller: decoded.role === 'seller',
      passesRoleCheck: decoded.role === 'seller'
    };

    if (decoded.role !== 'seller') {
      debugInfo.error = 'Role check failed - not a seller';
      return res.json({ success: false, debug: debugInfo });
    }

    // 4) Try to find seller in database
    let seller;
    try {
      seller = await Seller.findById(decoded.id);
      debugInfo.step4_database_lookup = {
        searchId: decoded.id,
        sellerFound: !!seller,
        sellerId: seller?._id?.toString(),
        sellerEmail: seller?.email,
        sellerStatus: seller?.status,
        sellerName: seller?.name
      };
    } catch (dbError) {
      debugInfo.step4_database_lookup = {
        searchId: decoded.id,
        error: dbError.message,
        success: false
      };
      return res.json({ success: false, debug: debugInfo });
    }

    if (!seller) {
      debugInfo.error = 'Seller not found in database';
      return res.json({ success: false, debug: debugInfo });
    }

    // 5) Check seller status
    debugInfo.step5_status_check = {
      currentStatus: seller.status,
      isSuspended: seller.status === 'suspended',
      isActive: seller.status === 'active',
      passesStatusCheck: seller.status !== 'suspended'
    };

    if (seller.status === 'suspended') {
      debugInfo.error = 'Seller account is suspended';
      return res.json({ success: false, debug: debugInfo });
    }

    // 6) Final user object that would be created
    debugInfo.step6_final_user = {
      id: seller._id,
      email: seller.email,
      role: 'seller',
      businessName: seller.businessName,
      status: seller.status,
      isImpersonated: decoded.isImpersonated,
      impersonatedBy: decoded.impersonatedBy
    };

    console.log('✅ DEBUG: Authentication would succeed');

    res.json({
      success: true,
      message: 'Authentication debug completed - should work!',
      debug: debugInfo
    });

  } catch (error) {
    console.error('❌ DEBUG: Error in auth debug:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      debug: { error: 'Debug endpoint crashed', details: error.message }
    });
  }
});

// Debug endpoint to check user permissions
router.get('/permissions', async (req, res) => {
  try {
    // 1) Get token from header
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    // 2) Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const debugInfo = {
      user: {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        isImpersonated: decoded.isImpersonated,
        impersonatedBy: decoded.impersonatedBy
      },
      tokenInfo: {
        exp: new Date(decoded.exp * 1000),
        iat: new Date(decoded.iat * 1000),
        isExpired: Date.now() >= decoded.exp * 1000
      }
    };

    console.log('🔍 DEBUG ENDPOINT - User permissions check:', debugInfo);

    res.json({
      success: true,
      debug: debugInfo
    });
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

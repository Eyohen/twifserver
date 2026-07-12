// middleware/auth.js
const { Merchant, Admin, TeamMember } = require('../models');
const jwt = require('jsonwebtoken');

// Merchant authentication middleware
// Supports both publicKey (new) and apiKey+apiSecret (legacy) authentication
const authenticateMerchant = async (req, res, next) => {
  try {
    const publicKey = req.headers['x-public-key'];
    const apiKey = req.headers['x-api-key'];
    const apiSecret = req.headers['x-api-secret'];

    let merchant = null;

    // Try public key authentication first (new method)
    if (publicKey) {
      console.log(`Authenticating with Public Key: ${publicKey.substring(0, 10)}...`);
      merchant = await Merchant.findOne({
        where: { publicKey }
      });
    }
    // Fall back to legacy apiKey + apiSecret authentication
    else if (apiKey && apiSecret) {
      console.log(`Authenticating with API Key (legacy): ${apiKey.substring(0, 8)}...`);
      merchant = await Merchant.findOne({
        where: { apiKey, apiSecret }
      });
    }

    if (!publicKey && (!apiKey || !apiSecret)) {
      return res.status(401).json({ error: 'API credentials required. Use x-public-key header or x-api-key and x-api-secret headers.' });
    }

    if (!merchant) {
      return res.status(401).json({ error: 'Invalid API credentials' });
    }
    
    // If merchant is suspended, don't allow API access
    if (merchant.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended' });
    }
    
    console.log(`Authenticated merchant: ${merchant.id} (${merchant.businessName})`);
    
    // Attach merchant info to request
    req.merchant = {
      id: merchant.id,
      email: merchant.email,
      businessName: merchant.businessName
    };
    
    // Debug to verify it's set properly
    console.log('Set merchant ID on request:', req.merchant.id);
    
    next();
  } catch (error) {
    console.error('API authentication error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Bearer token required' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'admin_secret_key');
    if (!decoded || !decoded.id || decoded.role !== 'admin') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Find admin
    const admin = await Admin.findByPk(decoded.id);
    if (!admin) {
      return res.status(401).json({ error: 'Admin not found' });
    }

    // Attach admin info to request
    req.admin = {
      id: admin.id,
      email: admin.email,
      name: admin.name
    };

    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Authentication error' });
  }
};

// JWT authentication middleware for merchants and team members
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Bearer token required' });
    }

    // Verify token with fallback secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dhudyed7wd6wydwydwy');

    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if it's a team member or merchant based on the type in token
    if (decoded.type === 'team_member') {
      // Find team member
      const teamMember = await TeamMember.findByPk(decoded.id);
      if (!teamMember || teamMember.status !== 'active') {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      // Attach user info to request
      req.user = {
        id: teamMember.id,
        email: teamMember.email,
        role: teamMember.role,
        merchantId: teamMember.merchantId,
        type: 'team_member'
      };
    } else {
      // Assume it's a merchant (backward compatibility)
      const merchant = await Merchant.findByPk(decoded.id);
      if (!merchant) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Attach user info to request
      req.user = {
        id: merchant.id,
        email: merchant.email,
        type: 'merchant'
      };

      // Also set req.merchant for backward compatibility
      req.merchant = {
        id: merchant.id,
        email: merchant.email,
        businessName: merchant.businessName
      };
    }

    next();
  } catch (error) {
    console.error('User authentication error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Authentication error' });
  }
};





module.exports = {
  authenticateMerchant,
  authenticateAdmin,
  authenticateUser
};
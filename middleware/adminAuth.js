const jwt = require('jsonwebtoken');
const { Admin } = require('../models');

const adminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No authentication token provided',
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if it's an admin token
      if (!decoded.adminId) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required',
        });
      }

      const admin = await Admin.findByPk(decoded.adminId);
      
      if (!admin) {
        return res.status(403).json({
          success: false,
          error: 'Admin not found',
        });
      }

      if (admin.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'Admin account is not active',
        });
      }

      req.admin = admin;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

module.exports = adminAuth;
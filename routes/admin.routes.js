const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../models');
const adminController = require('../controllers/admin.controller');

const { Admin } = db;
const router = express.Router();

const requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Admin access token required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.adminId) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const admin = await Admin.findByPk(decoded.adminId);
    if (!admin || admin.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Admin account is not active' });
    }

    req.admin = admin;
    return next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(401).json({ success: false, message: 'Invalid or expired admin token' });
  }
};

router.post('/auth/login', adminController.login);

router.use(requireAdmin);

router.get('/auth/me', adminController.me);
router.post('/auth/logout', adminController.logout);
router.get('/dashboard', adminController.getDashboard);
router.get('/users', adminController.getUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.get('/connections', adminController.getConnections);
router.get('/opportunities', adminController.getOpportunities);
router.get('/bookings', adminController.getBookings);
router.get('/notifications', adminController.getNotifications);

module.exports = router;

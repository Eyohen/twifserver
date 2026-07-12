const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const db = require('../models');
const { formatUserSummary } = require('../utils/profileFormatter');

const {
  Admin,
  AuditLog,
  Booking,
  BusinessProfile,
  Connection,
  Notification,
  Opportunity,
  OpportunityInterest,
  PersonalProfile,
  User,
} = db;

const ADMIN_TOKEN_EXPIRY = '8h';
const USER_STATUSES = ['active', 'inactive', 'suspended', 'pending_verification'];

const profileInclude = () => [
  { model: PersonalProfile, as: 'personalProfile', required: false },
  { model: BusinessProfile, as: 'businessProfile', required: false },
];

const userSummaryInclude = (as) => ({
  model: User,
  as,
  attributes: ['id', 'email', 'userType', 'verified', 'status', 'createdAt', 'lastLoginAt'],
  include: profileInclude(),
});

const signAdminToken = (admin) => jwt.sign(
  { adminId: admin.id, role: admin.role },
  process.env.JWT_SECRET,
  { expiresIn: ADMIN_TOKEN_EXPIRY }
);

const publicAdmin = (admin) => ({
  id: admin.id,
  email: admin.email,
  firstName: admin.firstName,
  lastName: admin.lastName,
  role: admin.role,
  permissions: admin.permissions,
  status: admin.status,
  lastLoginAt: admin.lastLoginAt,
});

const ensureSuperAdmin = (req, res) => {
  if (req.admin?.role !== 'super_admin') {
    res.status(403).json({ success: false, message: 'Super admin access required' });
    return false;
  }

  return true;
};

const createAuditLog = async (req, action, entity, entityId, newData = {}, previousData = null) => {
  if (!AuditLog || !req.admin?.id) return;

  try {
    await AuditLog.create({
      adminId: req.admin.id,
      action,
      entity,
      entityId,
      previousData,
      newData,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });
  } catch (error) {
    console.error('Admin audit log failed:', error);
  }
};

const toAdminUser = (user) => {
  if (!user) return null;

  return {
    ...formatUserSummary(user),
    email: user.email,
    status: user.status,
    verified: user.verified,
    onboardingCompleted: user.userType === 'business'
      ? user.businessProfile?.onboardingCompleted ?? user.onboardingCompleted
      : user.personalProfile?.onboardingCompleted ?? user.onboardingCompleted,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
};

const getPagination = (query) => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 100);
  return { page, limit, offset: (page - 1) * limit };
};

const userSearchWhere = ({ q, status, userType }) => {
  const where = {};
  if (status) where.status = status;
  if (userType) where.userType = userType;
  if (q) where.email = { [Op.iLike]: `%${q.trim()}%` };
  return where;
};

exports.login = async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ where: { email } });
    if (!admin || admin.status !== 'active') {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = signAdminToken(admin);
    await admin.update({
      lastLoginAt: new Date(),
      refreshToken: token,
    });
    await createAuditLog({ admin, ip: req.ip, get: req.get.bind(req) }, 'admin_login', 'admin', admin.id);

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: token,
        admin: publicAdmin(admin),
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ success: false, message: 'Admin login failed' });
  }
};

exports.logout = async (req, res) => {
  try {
    await req.admin.update({ refreshToken: null });
    await createAuditLog(req, 'admin_logout', 'admin', req.admin.id);
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Admin logout error:', error);
    return res.status(500).json({ success: false, message: 'Admin logout failed' });
  }
};

exports.me = (req, res) => res.json({
  success: true,
  data: { admin: publicAdmin(req.admin) },
});

exports.getDashboard = async (req, res) => {
  try {
    const [
      totalUsers,
      personalUsers,
      businessUsers,
      pendingUsers,
      suspendedUsers,
      totalConnections,
      pendingConnections,
      connectedConnections,
      totalOpportunities,
      activeOpportunities,
      totalBookings,
      pendingBookings,
      unreadNotifications,
      recentUsers,
    ] = await Promise.all([
      User.count(),
      User.count({ where: { userType: 'personal' } }),
      User.count({ where: { userType: 'business' } }),
      User.count({ where: { status: 'pending_verification' } }),
      User.count({ where: { status: 'suspended' } }),
      Connection.count(),
      Connection.count({ where: { status: 'pending' } }),
      Connection.count({ where: { status: 'connected' } }),
      Opportunity.count(),
      Opportunity.count({ where: { status: 'active' } }),
      Booking.count(),
      Booking.count({ where: { status: 'pending' } }),
      Notification.count({ where: { isRead: false } }),
      User.findAll({
        attributes: ['id', 'email', 'userType', 'verified', 'status', 'createdAt', 'lastLoginAt'],
        include: profileInclude(),
        order: [['createdAt', 'DESC']],
        limit: 6,
      }),
    ]);

    return res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          personalUsers,
          businessUsers,
          pendingUsers,
          suspendedUsers,
          totalConnections,
          pendingConnections,
          connectedConnections,
          totalOpportunities,
          activeOpportunities,
          totalBookings,
          pendingBookings,
          unreadNotifications,
        },
        recentUsers: recentUsers.map(toAdminUser),
      },
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load dashboard' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = userSearchWhere(req.query);

    const users = await User.findAndCountAll({
      where,
      attributes: ['id', 'email', 'userType', 'verified', 'status', 'onboardingCompleted', 'createdAt', 'lastLoginAt'],
      include: profileInclude(),
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        users: users.rows.map(toAdminUser),
        pagination: { page, limit, total: users.count, totalPages: Math.ceil(users.count / limit) },
      },
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load users' });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    if (!ensureSuperAdmin(req, res)) return;

    const { status } = req.body;
    if (!USER_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid user status' });
    }

    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'email', 'userType', 'verified', 'status', 'onboardingCompleted', 'createdAt', 'lastLoginAt'],
      include: profileInclude(),
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const previousData = { status: user.status };
    await user.update({ status });
    await createAuditLog(req, 'user_status_updated', 'user', user.id, { status }, previousData);

    return res.json({
      success: true,
      message: 'User status updated',
      data: { user: toAdminUser(user) },
    });
  } catch (error) {
    console.error('Admin update user status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update user status' });
  }
};

exports.getConnections = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = req.query.status ? { status: req.query.status } : {};

    const connections = await Connection.findAndCountAll({
      where,
      include: [
        userSummaryInclude('requester'),
        userSummaryInclude('recipient'),
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        connections: connections.rows.map((connection) => ({
          id: connection.id,
          status: connection.status,
          message: connection.message,
          createdAt: connection.createdAt,
          respondedAt: connection.respondedAt,
          requester: toAdminUser(connection.requester),
          recipient: toAdminUser(connection.recipient),
        })),
        pagination: { page, limit, total: connections.count, totalPages: Math.ceil(connections.count / limit) },
      },
    });
  } catch (error) {
    console.error('Admin connections error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load connections' });
  }
};

exports.getOpportunities = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = req.query.status ? { status: req.query.status } : {};

    const opportunities = await Opportunity.findAndCountAll({
      where,
      include: [
        userSummaryInclude('owner'),
        { model: OpportunityInterest, as: 'interests', required: false, attributes: ['id', 'status'] },
      ],
      distinct: true,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        opportunities: opportunities.rows.map((opportunity) => ({
          id: opportunity.id,
          title: opportunity.title,
          category: opportunity.category,
          description: opportunity.description,
          budget: opportunity.budget,
          location: opportunity.location,
          status: opportunity.status,
          createdAt: opportunity.createdAt,
          owner: toAdminUser(opportunity.owner),
          interestsCount: opportunity.interests?.length || 0,
        })),
        pagination: { page, limit, total: opportunities.count, totalPages: Math.ceil(opportunities.count / limit) },
      },
    });
  } catch (error) {
    console.error('Admin opportunities error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load opportunities' });
  }
};

exports.getBookings = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = req.query.status ? { status: req.query.status } : {};

    const bookings = await Booking.findAndCountAll({
      where,
      include: [
        userSummaryInclude('requester'),
        userSummaryInclude('recipient'),
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        bookings: bookings.rows.map((booking) => ({
          id: booking.id,
          status: booking.status,
          slotDate: booking.slotDate,
          slotDay: booking.slotDay,
          slotTime: booking.slotTime,
          scheduledFor: booking.scheduledFor,
          agenda: booking.agenda,
          createdAt: booking.createdAt,
          requester: toAdminUser(booking.requester),
          recipient: toAdminUser(booking.recipient),
        })),
        pagination: { page, limit, total: bookings.count, totalPages: Math.ceil(bookings.count / limit) },
      },
    });
  } catch (error) {
    console.error('Admin bookings error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load bookings' });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = {};
    if (req.query.type) where.type = req.query.type;
    if (req.query.isRead === 'true') where.isRead = true;
    if (req.query.isRead === 'false') where.isRead = false;

    const notifications = await Notification.findAndCountAll({
      where,
      include: [userSummaryInclude('user')],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        notifications: notifications.rows.map((notification) => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          referenceType: notification.referenceType,
          referenceId: notification.referenceId,
          isRead: notification.isRead,
          priority: notification.priority,
          createdAt: notification.createdAt,
          user: toAdminUser(notification.user),
        })),
        pagination: { page, limit, total: notifications.count, totalPages: Math.ceil(notifications.count / limit) },
      },
    });
  } catch (error) {
    console.error('Admin notifications error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load notifications' });
  }
};

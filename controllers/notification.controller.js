const db = require('../models');
const { Notification } = db;

// Get notifications
exports.getNotifications = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);
    const { unreadOnly } = req.query;
    const where = { userId: req.userId };
    if (unreadOnly === 'true') where.isRead = false;

    const notifications = await Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit
    });

    res.json({
      success: true,
      data: {
        notifications: notifications.rows,
        pagination: {
          page,
          limit,
          total: notifications.count,
          totalPages: Math.ceil(notifications.count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to get notifications' });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.count({
      where: { userId: req.userId, isRead: false }
    });
    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Get unread notifications count error:', error);
    res.status(500).json({ success: false, message: 'Failed to get count' });
  }
};

// Mark as read
exports.markAsRead = async (req, res) => {
  try {
    const [updated] = await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { id: req.params.id, userId: req.userId } }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Marked as read' });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

// Mark all as read
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { userId: req.userId, isRead: false } }
    );
    res.json({ success: true, message: 'All marked as read' });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const deleted = await Notification.destroy({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
};

// Get preferences
exports.getPreferences = async (req, res) => {
  try {
    // TODO: Implement user notification preferences
    res.json({
      success: true,
      data: {
        email: true,
        push: true,
        newRequest: true,
        newMessage: true,
        paymentReceived: true
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get preferences' });
  }
};

// Update preferences
exports.updatePreferences = async (req, res) => {
  try {
    // TODO: Implement preferences update
    res.json({ success: true, message: 'Preferences updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

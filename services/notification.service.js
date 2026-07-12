const db = require('../models');
const { sendNotificationEmail } = require('./email.service');

const { Notification, User } = db;

const createNotification = async ({
  userId,
  type,
  title,
  message,
  referenceType = null,
  referenceId = null,
  actionUrl = '/dashboard',
  priority = 'normal',
  metadata = {},
  sendEmail = true,
  emailSubject,
  ctaLabel
}) => {
  if (!userId || !type || !title || !message) {
    throw new Error('userId, type, title, and message are required to create a notification');
  }

  const notification = await Notification.create({
    userId,
    type,
    title,
    message,
    referenceType,
    referenceId,
    actionUrl,
    priority,
    metadata,
    emailSent: false
  });

  if (!sendEmail) {
    return notification;
  }

  try {
    const user = await User.findByPk(userId, { attributes: ['id', 'email'] });

    if (!user?.email) {
      return notification;
    }

    const emailSent = await sendNotificationEmail(user.email, {
      title,
      message,
      actionUrl,
      subject: emailSubject,
      ctaLabel
    });

    if (emailSent) {
      await notification.update({ emailSent: true, emailSentAt: new Date() });
    }
  } catch (error) {
    console.error('Notification email delivery failed:', error);
  }

  return notification;
};

module.exports = {
  createNotification
};

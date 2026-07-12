const { Op } = require('sequelize');
const db = require('../models');
const { formatUserSummary, getProfileName } = require('../utils/profileFormatter');
const { createNotification } = require('../services/notification.service');

const { Booking, User, PersonalProfile, BusinessProfile } = db;

const includeBookingUsers = [
  {
    model: User,
    as: 'requester',
    attributes: ['id', 'email', 'userType', 'verified'],
    include: [
      { model: PersonalProfile, as: 'personalProfile', required: false },
      { model: BusinessProfile, as: 'businessProfile', required: false },
    ],
  },
  {
    model: User,
    as: 'recipient',
    attributes: ['id', 'email', 'userType', 'verified'],
    include: [
      { model: PersonalProfile, as: 'personalProfile', required: false },
      { model: BusinessProfile, as: 'businessProfile', required: false },
    ],
  },
];

const findUserWithProfile = (id) => User.findByPk(id, {
  attributes: ['id', 'email', 'userType', 'verified', 'status'],
  include: [
    { model: PersonalProfile, as: 'personalProfile', required: false },
    { model: BusinessProfile, as: 'businessProfile', required: false },
  ],
});

const formatBooking = (booking, currentUserId) => {
  const isRequester = booking.requesterId === currentUserId;
  const otherUser = isRequester ? booking.recipient : booking.requester;

  return {
    id: booking.id,
    direction: isRequester ? 'sent' : 'received',
    status: booking.status,
    slotDate: booking.slotDate,
    slotDay: booking.slotDay,
    slotTime: booking.slotTime,
    scheduledFor: booking.scheduledFor,
    durationMinutes: booking.durationMinutes,
    agenda: booking.agenda,
    attachmentName: booking.attachmentName,
    createdAt: booking.createdAt,
    respondedAt: booking.respondedAt,
    cancelledAt: booking.cancelledAt,
    otherUser: otherUser ? formatUserSummary(otherUser) : null,
  };
};

exports.listBookings = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      where: {
        [Op.or]: [
          { requesterId: req.user.id },
          { recipientId: req.user.id },
        ],
      },
      include: includeBookingUsers,
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    const groups = {
      received: [],
      sent: [],
      accepted: [],
    };

    bookings.forEach((booking) => {
      const item = formatBooking(booking, req.user.id);

      if (booking.status === 'accepted') {
        groups.accepted.push(item);
      } else if (item.direction === 'received') {
        groups.received.push(item);
      } else {
        groups.sent.push(item);
      }
    });

    return res.json({ success: true, data: groups });
  } catch (error) {
    console.error('List bookings error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load bookings' });
  }
};

exports.createBooking = async (req, res) => {
  try {
    const {
      recipientId,
      slotDate,
      slotDay,
      slotTime,
      scheduledFor,
      durationMinutes = 30,
      agenda,
      attachmentName,
    } = req.body;

    if (!recipientId || recipientId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Valid booking recipient is required' });
    }

    if (!slotDate || !slotTime || !agenda?.trim()) {
      return res.status(400).json({ success: false, message: 'Slot date, slot time, and agenda are required' });
    }

    const recipient = await findUserWithProfile(recipientId);

    if (!recipient || !recipient.verified || recipient.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Booking recipient not found' });
    }

    const booking = await Booking.create({
      requesterId: req.user.id,
      recipientId,
      slotDate,
      slotDay: slotDay || null,
      slotTime,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      durationMinutes,
      agenda: agenda.trim(),
      attachmentName: attachmentName || null,
      status: 'pending',
    });

    const requester = await findUserWithProfile(req.user.id);
    const requesterName = getProfileName(requester);
    const slotLabel = `${slotDay ? `${slotDay}, ` : ''}${slotDate} at ${slotTime}`;

    await createNotification({
      userId: recipientId,
      type: 'booking_request',
      title: 'New booking request',
      message: `${requesterName} requested a meeting with you for ${slotLabel}.`,
      referenceType: 'booking',
      referenceId: booking.id,
      actionUrl: '/dashboard/bookings',
      priority: 'high',
      metadata: { requesterId: req.user.id },
      ctaLabel: 'Review booking'
    });

    const created = await Booking.findByPk(booking.id, { include: includeBookingUsers });
    return res.status(201).json({ success: true, message: 'Booking request sent', data: formatBooking(created, req.user.id) });
  } catch (error) {
    console.error('Create booking error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create booking request' });
  }
};

exports.acceptBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      where: { id: req.params.id, recipientId: req.user.id, status: 'pending' },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Pending booking request not found' });
    }

    await booking.update({ status: 'accepted', respondedAt: new Date() });

    const recipient = await findUserWithProfile(req.user.id);
    const recipientName = getProfileName(recipient);

    await createNotification({
      userId: booking.requesterId,
      type: 'booking_accepted',
      title: 'Booking accepted',
      message: `${recipientName} accepted your booking request for ${booking.slotDate} at ${booking.slotTime}.`,
      referenceType: 'booking',
      referenceId: booking.id,
      actionUrl: '/dashboard/bookings',
      metadata: { recipientId: req.user.id },
      ctaLabel: 'View booking'
    });

    return res.json({ success: true, message: 'Booking accepted', data: booking });
  } catch (error) {
    console.error('Accept booking error:', error);
    return res.status(500).json({ success: false, message: 'Failed to accept booking' });
  }
};

exports.declineBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      where: { id: req.params.id, recipientId: req.user.id, status: 'pending' },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Pending booking request not found' });
    }

    await booking.update({ status: 'declined', respondedAt: new Date() });

    await createNotification({
      userId: booking.requesterId,
      type: 'booking_declined',
      title: 'Booking declined',
      message: `Your booking request for ${booking.slotDate} at ${booking.slotTime} was declined.`,
      referenceType: 'booking',
      referenceId: booking.id,
      actionUrl: '/dashboard/bookings',
      metadata: { recipientId: req.user.id },
      ctaLabel: 'View bookings'
    });

    return res.json({ success: true, message: 'Booking declined', data: booking });
  } catch (error) {
    console.error('Decline booking error:', error);
    return res.status(500).json({ success: false, message: 'Failed to decline booking' });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      where: {
        id: req.params.id,
        requesterId: req.user.id,
        status: { [Op.in]: ['pending', 'accepted'] },
      },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Cancellable booking not found' });
    }

    await booking.update({ status: 'cancelled', cancelledAt: new Date() });

    const requester = await findUserWithProfile(req.user.id);
    const requesterName = getProfileName(requester);

    await createNotification({
      userId: booking.recipientId,
      type: 'booking_cancelled',
      title: 'Booking cancelled',
      message: `${requesterName} cancelled their booking for ${booking.slotDate} at ${booking.slotTime}.`,
      referenceType: 'booking',
      referenceId: booking.id,
      actionUrl: '/dashboard/bookings',
      metadata: { requesterId: req.user.id },
      ctaLabel: 'View bookings'
    });

    return res.json({ success: true, message: 'Booking cancelled', data: booking });
  } catch (error) {
    console.error('Cancel booking error:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel booking' });
  }
};

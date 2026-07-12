const { Op } = require('sequelize');
const db = require('../models');
const { formatUserSummary, getProfileName } = require('../utils/profileFormatter');
const { createNotification } = require('../services/notification.service');

const { Connection, User, PersonalProfile, BusinessProfile } = db;

const includeConnectionUsers = [
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

const formatConnection = (connection, currentUserId) => {
  const isRequester = connection.requesterId === currentUserId;
  const otherUser = isRequester ? connection.recipient : connection.requester;
  const direction = connection.status === 'pending'
    ? (isRequester ? 'sent' : 'received')
    : 'connected';

  return {
    id: connection.id,
    status: connection.status,
    direction,
    message: connection.message,
    createdAt: connection.createdAt,
    respondedAt: connection.respondedAt,
    ...formatUserSummary(otherUser),
  };
};

const findUserWithProfile = (id) => User.findByPk(id, {
  attributes: ['id', 'email', 'userType', 'verified'],
  include: [
    { model: PersonalProfile, as: 'personalProfile', required: false },
    { model: BusinessProfile, as: 'businessProfile', required: false },
  ],
});

exports.listConnections = async (req, res) => {
  try {
    const connections = await Connection.findAll({
      where: {
        [Op.or]: [
          { requesterId: req.user.id },
          { recipientId: req.user.id },
        ],
        status: { [Op.in]: ['pending', 'connected'] },
      },
      include: includeConnectionUsers,
      order: [['createdAt', 'DESC']],
    });

    const groups = {
      connected: [],
      pendingReceived: [],
      pendingSent: [],
    };

    connections.forEach((connection) => {
      const item = formatConnection(connection, req.user.id);

      if (connection.status === 'connected') {
        groups.connected.push(item);
      } else if (item.direction === 'received') {
        groups.pendingReceived.push(item);
      } else {
        groups.pendingSent.push(item);
      }
    });

    return res.json({ success: true, data: groups });
  } catch (error) {
    console.error('List connections error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load connections' });
  }
};

exports.sendConnectionRequest = async (req, res) => {
  try {
    const { recipientId, message } = req.body;

    if (!recipientId || recipientId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Valid recipient is required' });
    }

    const recipient = await User.findOne({
      where: { id: recipientId, status: 'active', verified: true },
      include: [
        { model: PersonalProfile, as: 'personalProfile', required: false },
        { model: BusinessProfile, as: 'businessProfile', required: false },
      ],
    });

    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    const existingConnections = await Connection.findAll({
      where: {
        [Op.or]: [
          { requesterId: req.user.id, recipientId },
          { requesterId: recipientId, recipientId: req.user.id },
        ],
      },
    });
    const activeConnection = existingConnections.find((connection) => connection.status !== 'declined');
    const declinedConnection = existingConnections.find((connection) => (
      connection.status === 'declined'
      && connection.requesterId === req.user.id
      && connection.recipientId === recipientId
    )) || existingConnections.find((connection) => connection.status === 'declined');

    if (activeConnection) {
      return res.status(409).json({ success: false, message: 'Connection request already exists' });
    }

    const requestData = {
      requesterId: req.user.id,
      recipientId,
      message: message || null,
      status: 'pending',
      respondedAt: null,
    };

    const connection = declinedConnection
      ? await declinedConnection.update({
          ...requestData,
          createdAt: new Date(),
        })
      : await Connection.create(requestData);

    const requester = await findUserWithProfile(req.user.id);
    const requesterName = getProfileName(requester);

    await createNotification({
      userId: recipientId,
      type: 'connection_request',
      title: 'New connection request',
      message: `${requesterName} wants to connect with you on Twif.`,
      referenceType: 'connection',
      referenceId: connection.id,
      actionUrl: '/dashboard/connections',
      priority: 'high',
      metadata: { requesterId: req.user.id },
      ctaLabel: 'Review request'
    });

    return res.status(201).json({ success: true, message: 'Connection request sent', data: connection });
  } catch (error) {
    console.error('Send connection request error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send connection request' });
  }
};

exports.acceptConnection = async (req, res) => {
  try {
    const connection = await Connection.findOne({
      where: {
        id: req.params.id,
        recipientId: req.user.id,
        status: 'pending',
      },
    });

    if (!connection) {
      return res.status(404).json({ success: false, message: 'Pending connection request not found' });
    }

    await connection.update({ status: 'connected', respondedAt: new Date() });

    const recipient = await findUserWithProfile(req.user.id);
    const recipientName = getProfileName(recipient);

    await createNotification({
      userId: connection.requesterId,
      type: 'connection_accepted',
      title: 'Connection accepted',
      message: `${recipientName} accepted your connection request.`,
      referenceType: 'connection',
      referenceId: connection.id,
      actionUrl: '/dashboard/connections',
      metadata: { recipientId: req.user.id },
      ctaLabel: 'View connection'
    });

    return res.json({ success: true, message: 'Connection accepted', data: connection });
  } catch (error) {
    console.error('Accept connection error:', error);
    return res.status(500).json({ success: false, message: 'Failed to accept connection' });
  }
};

exports.declineConnection = async (req, res) => {
  try {
    const connection = await Connection.findOne({
      where: {
        id: req.params.id,
        recipientId: req.user.id,
        status: 'pending',
      },
    });

    if (!connection) {
      return res.status(404).json({ success: false, message: 'Pending connection request not found' });
    }

    await connection.update({ status: 'declined', respondedAt: new Date() });
    return res.json({ success: true, message: 'Connection declined', data: connection });
  } catch (error) {
    console.error('Decline connection error:', error);
    return res.status(500).json({ success: false, message: 'Failed to decline connection' });
  }
};

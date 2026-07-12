const { Op } = require('sequelize');
const db = require('../models');
const papersignal = require('../services/papersignal.service');
const { formatUserSummary, getProfileForUser, getProfileName } = require('../utils/profileFormatter');

const { Connection, User, PersonalProfile, BusinessProfile } = db;

const includeProfiles = () => [
  { model: PersonalProfile, as: 'personalProfile', required: false },
  { model: BusinessProfile, as: 'businessProfile', required: false },
];

const userAttributes = ['id', 'email', 'userType', 'verified', 'status', 'createdAt'];

const loadUser = (id) => User.findByPk(id, {
  attributes: userAttributes,
  include: includeProfiles(),
});

const toPapersignalUser = (user) => {
  const profile = getProfileForUser(user);
  return {
    id: user.id,
    displayName: getProfileName(user),
    avatar: user.userType === 'business' ? profile?.logoUrl : profile?.avatarUrl,
  };
};

const getConnectedUsers = async (userId) => {
  const connections = await Connection.findAll({
    where: {
      status: 'connected',
      [Op.or]: [
        { requesterId: userId },
        { recipientId: userId },
      ],
    },
    include: [
      {
        model: User,
        as: 'requester',
        attributes: userAttributes,
        include: includeProfiles(),
      },
      {
        model: User,
        as: 'recipient',
        attributes: userAttributes,
        include: includeProfiles(),
      },
    ],
    order: [['updatedAt', 'DESC']],
  });

  return connections
    .map((connection) => {
      const otherUser = connection.requesterId === userId ? connection.recipient : connection.requester;
      if (!otherUser || otherUser.status !== 'active') return null;

      return {
        connectionId: connection.id,
        connectedAt: connection.respondedAt || connection.updatedAt,
        ...formatUserSummary(otherUser),
      };
    })
    .filter(Boolean);
};

const ensureConnected = async (userId, otherUserId) => {
  if (!otherUserId || userId === otherUserId) return false;

  const count = await Connection.count({
    where: {
      status: 'connected',
      [Op.or]: [
        { requesterId: userId, recipientId: otherUserId },
        { requesterId: otherUserId, recipientId: userId },
      ],
    },
  });

  return count > 0;
};

const roomParticipants = (room = {}) => room.participants || room.members || [];

const participantUserId = (participant = {}) =>
  participant.userId ||
  participant.externalId ||
  participant.id ||
  participant.user?.id ||
  participant.user?.externalId;

const roomHasUser = (room, userId) =>
  roomParticipants(room).some((participant) => participantUserId(participant) === userId);

const assertRoomAccess = async (roomId, userId, options = {}) => {
  const result = await papersignal.getRoom(roomId, options);
  const room = result.room || result.data?.room || result;

  if (!room || !roomHasUser(room, userId)) {
    const error = new Error('Access denied');
    error.status = 403;
    throw error;
  }

  return { result, room };
};

const transformMessage = (message = {}, currentUserId) => ({
  id: message.id,
  senderId: message.userId || message.sender?.externalId || message.sender?.id,
  senderName: message.userName || message.sender?.displayName || 'User',
  senderAvatar: message.userAvatar || message.sender?.avatarUrl || null,
  content: message.content || '',
  messageType: message.messageType || 'text',
  reactions: message.reactions || {},
  isEdited: Boolean(message.editedAt || message.edited),
  isDeleted: Boolean(message.isDeleted || message.deleted),
  isMine: (message.userId || message.sender?.externalId || message.sender?.id) === currentUserId,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

const normalizeConversation = (conversation = {}, currentUserId) => {
  const participants = roomParticipants(conversation);
  const otherParticipant = participants.find((participant) => participantUserId(participant) !== currentUserId);
  const otherParticipantName = otherParticipant?.userName || otherParticipant?.displayName || otherParticipant?.name;
  const displayName = conversation.type === 'direct'
    ? (otherParticipantName || 'Conversation')
    : (conversation.name || otherParticipantName || 'Conversation');

  return {
    id: conversation.id,
    roomId: conversation.id,
    name: displayName,
    type: conversation.type || 'direct',
    participants,
    unreadCount: conversation.unreadCount || 0,
    lastMessage: conversation.lastMessage || null,
    lastMessageAt: conversation.lastMessageAt,
    otherUserId: participantUserId(otherParticipant),
    avatar: displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'CN',
  };
};

exports.getConfig = (req, res) => {
  res.json({
    success: true,
    data: {
      socketUrl: papersignal.getSocketUrl(),
    },
  });
};

exports.getContacts = async (req, res) => {
  try {
    const contacts = await getConnectedUsers(req.userId);
    res.json({ success: true, data: contacts });
  } catch (error) {
    console.error('Get message contacts error:', error);
    res.status(500).json({ success: false, message: 'Failed to get contacts' });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const result = await papersignal.getUserConversations(req.userId, { page, limit, type });

    res.json({
      success: true,
      data: {
        conversations: (result.conversations || []).map((conversation) => normalizeConversation(conversation, req.userId)),
        pagination: result.pagination || { page: Number(page), limit: Number(limit), total: result.conversations?.length || 0, totalPages: 1 },
      },
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Failed to get conversations' });
  }
};

exports.createDirectConversation = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const connected = await ensureConnected(req.userId, recipientId);

    if (!connected) {
      return res.status(403).json({ success: false, message: 'You can only message accepted connections' });
    }

    const [currentUser, recipient] = await Promise.all([
      loadUser(req.userId),
      loadUser(recipientId),
    ]);

    if (!currentUser || !recipient || recipient.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    const result = await papersignal.getOrCreateDirectConversation(
      toPapersignalUser(currentUser),
      toPapersignalUser(recipient),
      { source: 'twif', connectionOnly: true }
    );

    res.status(result.created ? 201 : 200).json({
      success: true,
      data: {
        room: normalizeConversation(result.room, req.userId),
        created: Boolean(result.created),
      },
    });
  } catch (error) {
    console.error('Create direct conversation error:', error);
    res.status(500).json({ success: false, message: 'Failed to start conversation' });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 100);
    const { result, room } = await assertRoomAccess(req.params.roomId, req.userId, {
      limit,
      before: req.query.before,
    });

    res.json({
      success: true,
      data: {
        room: normalizeConversation(room, req.userId),
        messages: (room.messages || result.messages || []).map((message) => transformMessage(message, req.userId)),
      },
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(error.status || 500).json({ success: false, message: error.status === 403 ? 'Access denied' : 'Failed to get conversation' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 100);
    const { result, room } = await assertRoomAccess(req.params.roomId, req.userId, {
      limit,
      before: req.query.before,
    });

    res.json({
      success: true,
      data: {
        messages: (room.messages || result.messages || []).map((message) => transformMessage(message, req.userId)),
        pagination: { limit, hasMore: (room.messages || result.messages || []).length === limit },
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(error.status || 500).json({ success: false, message: error.status === 403 ? 'Access denied' : 'Failed to get messages' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { content, messageType = 'text', metadata = {} } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    await assertRoomAccess(req.params.roomId, req.userId, { limit: 1 });

    const currentUser = await loadUser(req.userId);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userInfo = toPapersignalUser(currentUser);
    const result = await papersignal.sendMessage(req.params.roomId, {
      userId: req.userId,
      userName: userInfo.displayName,
      userAvatar: userInfo.avatar,
      content: content.trim(),
      messageType,
      metadata: { ...metadata, source: 'twif' },
    });

    res.status(201).json({
      success: true,
      data: transformMessage(result.message || result.data?.message || result, req.userId),
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(error.status || 500).json({ success: false, message: error.status === 403 ? 'Access denied' : 'Failed to send message' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await assertRoomAccess(req.params.roomId, req.userId, { limit: 1 });
    const result = await papersignal.markAsRead(req.params.roomId, req.userId, req.body.messageId || null);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(error.status || 500).json({ success: false, message: error.status === 403 ? 'Access denied' : 'Failed to mark as read' });
  }
};

exports.addReaction = async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ success: false, message: 'Emoji is required' });

    await assertRoomAccess(req.params.roomId, req.userId, { limit: 1 });
    const currentUser = await loadUser(req.userId);
    const result = await papersignal.addReaction(req.params.roomId, req.params.messageId, {
      userId: req.userId,
      userName: getProfileName(currentUser),
      emoji,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(error.status || 500).json({ success: false, message: error.status === 403 ? 'Access denied' : 'Failed to add reaction' });
  }
};

exports.removeReaction = async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ success: false, message: 'Emoji is required' });

    await assertRoomAccess(req.params.roomId, req.userId, { limit: 1 });
    const result = await papersignal.removeReaction(req.params.roomId, req.params.messageId, req.userId, emoji);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(error.status || 500).json({ success: false, message: error.status === 403 ? 'Access denied' : 'Failed to remove reaction' });
  }
};

exports.editMessage = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Content is required' });

    await assertRoomAccess(req.params.roomId, req.userId, { limit: 1 });
    const result = await papersignal.editMessage(req.params.roomId, req.params.messageId, req.userId, content.trim());
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(error.status || 500).json({ success: false, message: error.status === 403 ? 'Access denied' : 'Failed to edit message' });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    await assertRoomAccess(req.params.roomId, req.userId, { limit: 1 });
    const result = await papersignal.deleteMessage(req.params.roomId, req.params.messageId, req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(error.status || 500).json({ success: false, message: error.status === 403 ? 'Access denied' : 'Failed to delete message' });
  }
};

exports.getPresence = async (req, res) => {
  try {
    const result = await papersignal.getPresence(req.params.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get presence error:', error);
    res.status(500).json({ success: false, message: 'Failed to get presence' });
  }
};

exports.getBulkPresence = async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) {
      return res.status(400).json({ success: false, message: 'userIds array is required' });
    }

    const result = await papersignal.getBulkPresence(userIds);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get bulk presence error:', error);
    res.status(500).json({ success: false, message: 'Failed to get presence' });
  }
};

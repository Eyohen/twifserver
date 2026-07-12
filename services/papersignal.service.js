// services/papersignal.service.js - Papersignal In-App Messaging API wrapper
const axios = require('axios');

const PAPERSIGNAL_API_URL = process.env.PAPERSIGNAL_API_URL || 'https://mailserver-production.up.railway.app';
const PAPERSIGNAL_API_KEY = process.env.PAPERSIGNAL_API_KEY;

// Create axios instance with default config
const api = axios.create({
  baseURL: `${PAPERSIGNAL_API_URL}/api/external-chat`,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': PAPERSIGNAL_API_KEY
  },
  timeout: 30000
});

// Request/response logging for debugging
api.interceptors.request.use(request => {
  console.log('📤 Papersignal Request:', request.method?.toUpperCase(), request.url);
  return request;
});

api.interceptors.response.use(
  response => {
    console.log('📥 Papersignal Response:', response.status, response.config.url);
    return response;
  },
  error => {
    console.error('❌ Papersignal Error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
);

// ==================== CONVERSATIONS ====================

/**
 * Get or create a direct conversation between two users
 * @param {Object} user1 - { id, displayName, avatar }
 * @param {Object} user2 - { id, displayName, avatar }
 * @param {Object} metadata - Optional metadata (e.g., requestId, localConversationId)
 * @returns {Object} { room, created }
 */
const getOrCreateDirectConversation = async (user1, user2, metadata = {}) => {
  try {
    const response = await api.post('/conversations/direct', {
      user1Id: user1.id,
      user1Name: user1.displayName,
      user1Avatar: user1.avatar || null,
      user2Id: user2.id,
      user2Name: user2.displayName,
      user2Avatar: user2.avatar || null,
      metadata
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get/create direct conversation:', error.message);
    throw error;
  }
};

/**
 * Get all conversations for a user with unread counts
 * @param {string} userId - User's ID
 * @param {Object} options - { type, page, limit }
 * @returns {Object} { conversations, pagination }
 */
const getUserConversations = async (userId, options = {}) => {
  try {
    const { type, page = 1, limit = 20 } = options;
    const params = new URLSearchParams({ page, limit });
    if (type) params.append('type', type);

    const response = await api.get(`/users/${userId}/conversations?${params}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get user conversations:', error.message);
    throw error;
  }
};

/**
 * Get a room by ID with message history
 * @param {string} roomId - Room ID
 * @param {Object} options - { limit, before }
 * @returns {Object} Room with messages
 */
const getRoom = async (roomId, options = {}) => {
  try {
    const { limit = 50, before } = options;
    const params = new URLSearchParams({ limit });
    if (before) params.append('before', before);

    const response = await api.get(`/rooms/${roomId}?${params}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get room:', error.message);
    throw error;
  }
};

/**
 * Create a new room (group or channel)
 * @param {Object} roomData - { name, type, participants, metadata }
 * @returns {Object} Created room
 */
const createRoom = async (roomData) => {
  try {
    const response = await api.post('/rooms', roomData);
    return response.data;
  } catch (error) {
    console.error('Failed to create room:', error.message);
    throw error;
  }
};

/**
 * Delete a room
 * @param {string} roomId - Room ID
 */
const deleteRoom = async (roomId) => {
  try {
    const response = await api.delete(`/rooms/${roomId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to delete room:', error.message);
    throw error;
  }
};

// ==================== MESSAGES ====================

/**
 * Send a message to a room
 * @param {string} roomId - Room ID
 * @param {Object} messageData - { userId, userName, userAvatar, content, messageType, metadata }
 * @returns {Object} Created message
 */
const sendMessage = async (roomId, messageData) => {
  try {
    const response = await api.post(`/rooms/${roomId}/messages`, {
      userId: messageData.userId,
      userName: messageData.userName,
      userAvatar: messageData.userAvatar || null,
      content: messageData.content,
      messageType: messageData.messageType || 'text',
      metadata: messageData.metadata || {}
    });
    return response.data;
  } catch (error) {
    console.error('Failed to send message:', error.message);
    throw error;
  }
};

/**
 * Edit a message
 * @param {string} roomId - Room ID
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID (must be original sender)
 * @param {string} content - New message content
 * @returns {Object} Updated message
 */
const editMessage = async (roomId, messageId, userId, content) => {
  try {
    const response = await api.patch(`/rooms/${roomId}/messages/${messageId}`, {
      userId,
      content
    });
    return response.data;
  } catch (error) {
    console.error('Failed to edit message:', error.message);
    throw error;
  }
};

/**
 * Delete a message (soft delete)
 * @param {string} roomId - Room ID
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID (must be original sender)
 * @returns {Object} Deletion result
 */
const deleteMessage = async (roomId, messageId, userId) => {
  try {
    const response = await api.delete(`/rooms/${roomId}/messages/${messageId}`, {
      data: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to delete message:', error.message);
    throw error;
  }
};

/**
 * Mark messages as read in a room
 * @param {string} roomId - Room ID
 * @param {string} userId - User ID
 * @param {string} messageId - Optional specific message ID
 * @returns {Object} Result
 */
const markAsRead = async (roomId, userId, messageId = null) => {
  try {
    const body = { userId };
    if (messageId) body.messageId = messageId;

    const response = await api.post(`/rooms/${roomId}/read`, body);
    return response.data;
  } catch (error) {
    console.error('Failed to mark as read:', error.message);
    throw error;
  }
};

// ==================== REACTIONS ====================

/**
 * Add a reaction to a message
 * @param {string} roomId - Room ID
 * @param {string} messageId - Message ID
 * @param {Object} reactionData - { userId, userName, emoji }
 * @returns {Object} Reaction result
 */
const addReaction = async (roomId, messageId, reactionData) => {
  try {
    const response = await api.post(`/rooms/${roomId}/messages/${messageId}/reactions`, {
      userId: reactionData.userId,
      userName: reactionData.userName,
      emoji: reactionData.emoji
    });
    return response.data;
  } catch (error) {
    console.error('Failed to add reaction:', error.message);
    throw error;
  }
};

/**
 * Remove a reaction from a message
 * @param {string} roomId - Room ID
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID
 * @param {string} emoji - Emoji to remove
 * @returns {Object} Result
 */
const removeReaction = async (roomId, messageId, userId, emoji) => {
  try {
    const response = await api.delete(`/rooms/${roomId}/messages/${messageId}/reactions`, {
      data: { userId, emoji }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to remove reaction:', error.message);
    throw error;
  }
};

/**
 * Get all reactions for a message
 * @param {string} roomId - Room ID
 * @param {string} messageId - Message ID
 * @returns {Object} { reactions, total }
 */
const getReactions = async (roomId, messageId) => {
  try {
    const response = await api.get(`/rooms/${roomId}/messages/${messageId}/reactions`);
    return response.data;
  } catch (error) {
    console.error('Failed to get reactions:', error.message);
    throw error;
  }
};

// ==================== PRESENCE ====================

/**
 * Update user presence status
 * @param {string} userId - User ID
 * @param {Object} presenceData - { status, userName, metadata }
 * @returns {Object} Result
 */
const updatePresence = async (userId, presenceData) => {
  try {
    const response = await api.post(`/users/${userId}/presence`, {
      status: presenceData.status, // 'online', 'away', 'offline'
      userName: presenceData.userName,
      metadata: presenceData.metadata || {}
    });
    return response.data;
  } catch (error) {
    console.error('Failed to update presence:', error.message);
    throw error;
  }
};

/**
 * Get user presence status
 * @param {string} userId - User ID
 * @returns {Object} Presence data
 */
const getPresence = async (userId) => {
  try {
    const response = await api.get(`/users/${userId}/presence`);
    return response.data;
  } catch (error) {
    console.error('Failed to get presence:', error.message);
    throw error;
  }
};

/**
 * Get presence for multiple users
 * @param {Array} userIds - Array of user IDs
 * @returns {Object} Bulk presence data
 */
const getBulkPresence = async (userIds) => {
  try {
    const response = await api.post('/users/presence/bulk', { userIds });
    return response.data;
  } catch (error) {
    console.error('Failed to get bulk presence:', error.message);
    throw error;
  }
};

// ==================== PARTICIPANTS ====================

/**
 * Add a participant to a room
 * @param {string} roomId - Room ID
 * @param {Object} participantData - { userId, userName, userAvatar, role }
 * @returns {Object} Result
 */
const addParticipant = async (roomId, participantData) => {
  try {
    const response = await api.post(`/rooms/${roomId}/participants`, {
      userId: participantData.userId,
      userName: participantData.userName,
      userAvatar: participantData.userAvatar || null,
      role: participantData.role || 'member'
    });
    return response.data;
  } catch (error) {
    console.error('Failed to add participant:', error.message);
    throw error;
  }
};

/**
 * Remove a participant from a room
 * @param {string} roomId - Room ID
 * @param {string} userId - User ID to remove
 * @returns {Object} Result
 */
const removeParticipant = async (roomId, userId) => {
  try {
    const response = await api.delete(`/rooms/${roomId}/participants/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to remove participant:', error.message);
    throw error;
  }
};

// ==================== WEBHOOKS ====================

/**
 * Create a webhook
 * @param {Object} webhookData - { url, events }
 * @returns {Object} Created webhook with secret
 */
const createWebhook = async (webhookData) => {
  try {
    const response = await api.post('/webhooks', {
      url: webhookData.url,
      events: webhookData.events
    });
    return response.data;
  } catch (error) {
    console.error('Failed to create webhook:', error.message);
    throw error;
  }
};

/**
 * List all webhooks
 * @returns {Object} Webhooks list
 */
const listWebhooks = async () => {
  try {
    const response = await api.get('/webhooks');
    return response.data;
  } catch (error) {
    console.error('Failed to list webhooks:', error.message);
    throw error;
  }
};

/**
 * Delete a webhook
 * @param {string} webhookId - Webhook ID
 * @returns {Object} Result
 */
const deleteWebhook = async (webhookId) => {
  try {
    const response = await api.delete(`/webhooks/${webhookId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to delete webhook:', error.message);
    throw error;
  }
};

// ==================== UTILITIES ====================

/**
 * Test the Papersignal connection
 * @returns {Object} { success, error }
 */
const testConnection = async () => {
  try {
    if (!PAPERSIGNAL_API_KEY) {
      throw new Error('PAPERSIGNAL_API_KEY is not set');
    }
    // Try to get rooms list as a connectivity test
    await api.get('/rooms?limit=1');
    console.log('✅ Papersignal service connected');
    return { success: true };
  } catch (error) {
    console.error('❌ Papersignal connection failed:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get the Socket.IO URL for client connections
 * @returns {string} Socket URL
 */
const getSocketUrl = () => {
  return PAPERSIGNAL_API_URL;
};

module.exports = {
  // Conversations
  getOrCreateDirectConversation,
  getUserConversations,
  getRoom,
  createRoom,
  deleteRoom,

  // Messages
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead,

  // Reactions
  addReaction,
  removeReaction,
  getReactions,

  // Presence
  updatePresence,
  getPresence,
  getBulkPresence,

  // Participants
  addParticipant,
  removeParticipant,

  // Webhooks
  createWebhook,
  listWebhooks,
  deleteWebhook,

  // Utilities
  testConnection,
  getSocketUrl
};

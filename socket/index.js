const jwt = require('jsonwebtoken');
const { io: SocketIOClient } = require('socket.io-client');
const db = require('../models');
const { User, Creator, Brand, Conversation, Notification } = db;
const papersignal = require('../services/papersignal.service');

// Store online users
const onlineUsers = new Map();

// Store Papersignal socket connections per user
const papersignalSockets = new Map();

// Get user display info
const getUserDisplayInfo = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) return null;

  if (user.userType === 'creator') {
    const creator = await Creator.findOne({ where: { userId } });
    return {
      id: userId,
      displayName: creator?.displayName || 'Creator',
      avatar: creator?.profileImage || null,
      entityId: creator?.id,
      entityType: 'creator'
    };
  } else if (user.userType === 'brand') {
    const brand = await Brand.findOne({ where: { userId } });
    return {
      id: userId,
      displayName: brand?.companyName || 'Brand',
      avatar: brand?.logo || null,
      entityId: brand?.id,
      entityType: 'brand'
    };
  }
  return null;
};

// Create Papersignal socket connection for a user
const createPapersignalConnection = (userId, userInfo) => {
  const psSocketUrl = papersignal.getSocketUrl();

  const psSocket = SocketIOClient(psSocketUrl, {
    transports: ['websocket'],
    autoConnect: true
  });

  psSocket.on('connect', () => {
    console.log(`Papersignal socket connected for user ${userId}`);
    // Update presence to online
    papersignal.updatePresence(userId, {
      status: 'online',
      userName: userInfo?.displayName || 'User'
    }).catch(err => console.error('Failed to update presence:', err.message));
  });

  psSocket.on('disconnect', () => {
    console.log(`Papersignal socket disconnected for user ${userId}`);
  });

  psSocket.on('error', (error) => {
    console.error(`Papersignal socket error for user ${userId}:`, error);
  });

  return psSocket;
};

// Socket authentication middleware
const socketAuthMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);

    if (!user || user.status !== 'active') {
      return next(new Error('User not found or inactive'));
    }

    socket.userId = user.id;
    socket.userType = user.userType;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
};

// Initialize socket handlers
const initializeSocket = (io) => {
  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${userId}`);

    // Get user display info
    const userInfo = await getUserDisplayInfo(userId);

    // Add user to online users
    onlineUsers.set(userId, socket.id);

    // Join user's personal room for notifications
    socket.join(`user:${userId}`);

    // Create Papersignal connection for this user (if not exists)
    if (!papersignalSockets.has(userId)) {
      const psSocket = createPapersignalConnection(userId, userInfo);
      papersignalSockets.set(userId, psSocket);

      // Bridge Papersignal events to local socket
      psSocket.on('receive-room-message', (data) => {
        // Find local conversation by Papersignal room ID
        Conversation.findOne({ where: { papersignalRoomId: data.roomId } })
          .then(conversation => {
            if (conversation) {
              io.to(`conversation:${conversation.id}`).emit('new_message', {
                id: data.message?.id,
                conversationId: conversation.id,
                senderId: data.message?.userId,
                senderName: data.message?.userName,
                content: data.message?.content,
                messageType: data.message?.messageType || 'text',
                reactions: data.message?.reactions || {},
                createdAt: data.message?.createdAt
              });
            }
          })
          .catch(err => console.error('Error bridging message:', err));
      });

      psSocket.on('user-typing-in-room', (data) => {
        Conversation.findOne({ where: { papersignalRoomId: data.roomId } })
          .then(conversation => {
            if (conversation) {
              io.to(`conversation:${conversation.id}`).emit('user_typing', {
                conversationId: conversation.id,
                userId: data.userId,
                userName: data.userName
              });
            }
          });
      });

      psSocket.on('reaction-added', (data) => {
        Conversation.findOne({ where: { papersignalRoomId: data.roomId } })
          .then(conversation => {
            if (conversation) {
              io.to(`conversation:${conversation.id}`).emit('reaction_added', {
                conversationId: conversation.id,
                messageId: data.messageId,
                userId: data.userId,
                userName: data.userName,
                emoji: data.emoji
              });
            }
          });
      });

      psSocket.on('reaction-removed', (data) => {
        Conversation.findOne({ where: { papersignalRoomId: data.roomId } })
          .then(conversation => {
            if (conversation) {
              io.to(`conversation:${conversation.id}`).emit('reaction_removed', {
                conversationId: conversation.id,
                messageId: data.messageId,
                userId: data.userId,
                emoji: data.emoji
              });
            }
          });
      });

      psSocket.on('message-updated', (data) => {
        Conversation.findOne({ where: { papersignalRoomId: data.roomId } })
          .then(conversation => {
            if (conversation) {
              io.to(`conversation:${conversation.id}`).emit('message_edited', {
                conversationId: conversation.id,
                messageId: data.messageId,
                content: data.content,
                editedAt: data.editedAt
              });
            }
          });
      });

      psSocket.on('message-deleted', (data) => {
        Conversation.findOne({ where: { papersignalRoomId: data.roomId } })
          .then(conversation => {
            if (conversation) {
              io.to(`conversation:${conversation.id}`).emit('message_deleted', {
                conversationId: conversation.id,
                messageId: data.messageId,
                deletedAt: data.deletedAt
              });
            }
          });
      });

      psSocket.on('messages-read', (data) => {
        Conversation.findOne({ where: { papersignalRoomId: data.roomId } })
          .then(conversation => {
            if (conversation) {
              io.to(`conversation:${conversation.id}`).emit('messages_read', {
                conversationId: conversation.id,
                userId: data.userId,
                lastReadAt: data.lastReadAt
              });
            }
          });
      });

      psSocket.on('presence-updated', (data) => {
        io.emit('presence_change', {
          userId: data.userId,
          status: data.status
        });
      });
    }

    // Emit online status to relevant users
    socket.broadcast.emit('user_online', { userId });

    // Update presence in Papersignal
    papersignal.updatePresence(userId, {
      status: 'online',
      userName: userInfo?.displayName || 'User'
    }).catch(err => console.error('Failed to update presence:', err.message));

    // Handle joining conversation rooms
    socket.on('join_conversation', async (conversationId) => {
      try {
        const conversation = await Conversation.findByPk(conversationId, {
          include: [
            { model: Creator, as: 'creator', include: [{ model: User, as: 'user', attributes: ['id'] }] },
            { model: Brand, as: 'brand', include: [{ model: User, as: 'user', attributes: ['id'] }] }
          ]
        });

        if (!conversation) {
          return socket.emit('error', { message: 'Conversation not found' });
        }

        // Check if user is participant
        const isCreator = conversation.creator?.user?.id === userId;
        const isBrand = conversation.brand?.user?.id === userId;

        if (!isCreator && !isBrand) {
          return socket.emit('error', { message: 'Not authorized for this conversation' });
        }

        // Join local room
        socket.join(`conversation:${conversationId}`);

        // Join Papersignal room if exists
        if (conversation.papersignalRoomId) {
          const psSocket = papersignalSockets.get(userId);
          if (psSocket) {
            psSocket.emit('join-room', {
              roomId: conversation.papersignalRoomId,
              userId,
              userName: userInfo?.displayName || 'User'
            });
          }
        }

        socket.emit('joined_conversation', { conversationId });
      } catch (error) {
        console.error('Join conversation error:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    // Handle leaving conversation rooms
    socket.on('leave_conversation', async (conversationId) => {
      socket.leave(`conversation:${conversationId}`);

      // Leave Papersignal room if exists
      const conversation = await Conversation.findByPk(conversationId);
      if (conversation?.papersignalRoomId) {
        const psSocket = papersignalSockets.get(userId);
        if (psSocket) {
          psSocket.emit('leave-room', {
            roomId: conversation.papersignalRoomId,
            userId
          });
        }
      }
    });

    // Handle typing indicator (via Papersignal)
    socket.on('typing_start', async (data) => {
      const { conversationId } = data;

      const conversation = await Conversation.findByPk(conversationId);
      if (conversation?.papersignalRoomId) {
        const psSocket = papersignalSockets.get(userId);
        if (psSocket) {
          psSocket.emit('typing-in-room', {
            roomId: conversation.papersignalRoomId,
            userId,
            userName: userInfo?.displayName || 'User'
          });
        }
      }

      // Also emit locally for immediate feedback
      socket.to(`conversation:${conversationId}`).emit('user_typing', {
        userId,
        userName: userInfo?.displayName || 'User',
        conversationId
      });
    });

    socket.on('typing_stop', async (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('user_stopped_typing', {
        userId,
        conversationId
      });
    });

    // Handle message read (via REST, but can also be done via socket)
    socket.on('mark_read', async (data) => {
      try {
        const { conversationId } = data;

        const conversation = await Conversation.findByPk(conversationId);
        if (!conversation) return;

        // Mark as read in Papersignal
        if (conversation.papersignalRoomId) {
          await papersignal.markAsRead(conversation.papersignalRoomId, userId);
        }

        // Reset local unread count
        const creatorCheck = await Creator.findOne({ where: { userId } });
        if (creatorCheck && creatorCheck.id === conversation.creatorId) {
          await conversation.update({ creatorUnreadCount: 0 });
        } else {
          await conversation.update({ brandUnreadCount: 0 });
        }

        // Notify other participants
        socket.to(`conversation:${conversationId}`).emit('messages_read', {
          conversationId,
          userId,
          readAt: new Date()
        });
      } catch (error) {
        console.error('Mark read error:', error);
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId}`);
      onlineUsers.delete(userId);

      // Update presence to offline in Papersignal
      papersignal.updatePresence(userId, {
        status: 'offline',
        userName: userInfo?.displayName || 'User'
      }).catch(err => console.error('Failed to update presence:', err.message));

      // Clean up Papersignal socket after a delay (in case of reconnection)
      setTimeout(() => {
        if (!onlineUsers.has(userId)) {
          const psSocket = papersignalSockets.get(userId);
          if (psSocket) {
            psSocket.disconnect();
            papersignalSockets.delete(userId);
          }
        }
      }, 30000); // 30 second delay before cleanup

      socket.broadcast.emit('user_offline', { userId });
    });
  });

  // Helper function to emit to specific user
  io.emitToUser = (userId, event, data) => {
    io.to(`user:${userId}`).emit(event, data);
  };

  // Helper function to emit notification
  io.sendNotification = async (userId, notification) => {
    // Save to database
    const saved = await Notification.create({
      userId,
      ...notification,
      isRead: false
    });

    // Emit to user
    io.to(`user:${userId}`).emit('notification', saved.toJSON());

    return saved;
  };

  // Helper to check if user is online
  io.isUserOnline = (userId) => {
    return onlineUsers.has(userId);
  };

  return io;
};

module.exports = initializeSocket;

const express = require('express');
const messageController = require('../controllers/message.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { validate, validations } = require('../middleware/validate.middleware');

const router = express.Router();

router.use(verifyToken);

router.get('/config', messageController.getConfig);
router.get('/contacts', messageController.getContacts);
router.get('/conversations', messageController.getConversations);
router.post('/conversations/direct', messageController.createDirectConversation);
router.get('/conversations/:roomId', messageController.getConversation);
router.get('/conversations/:roomId/messages', messageController.getMessages);
router.post('/conversations/:roomId/messages', validations.message, validate, messageController.sendMessage);
router.post('/conversations/:roomId/read', messageController.markAsRead);
router.patch('/conversations/:roomId/messages/:messageId', messageController.editMessage);
router.delete('/conversations/:roomId/messages/:messageId', messageController.deleteMessage);
router.post('/conversations/:roomId/messages/:messageId/reactions', messageController.addReaction);
router.delete('/conversations/:roomId/messages/:messageId/reactions', messageController.removeReaction);
router.get('/users/:userId/presence', messageController.getPresence);
router.post('/users/presence/bulk', messageController.getBulkPresence);

module.exports = router;

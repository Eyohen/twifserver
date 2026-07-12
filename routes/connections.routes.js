const express = require('express');
const connectionsController = require('../controllers/connections.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', verifyToken, connectionsController.listConnections);
router.post('/request', verifyToken, connectionsController.sendConnectionRequest);
router.patch('/:id/accept', verifyToken, connectionsController.acceptConnection);
router.patch('/:id/decline', verifyToken, connectionsController.declineConnection);

module.exports = router;

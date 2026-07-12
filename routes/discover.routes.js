const express = require('express');
const discoverController = require('../controllers/discover.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', verifyToken, discoverController.listDiscoverProfiles);

module.exports = router;

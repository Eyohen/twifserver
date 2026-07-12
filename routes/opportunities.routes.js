const express = require('express');
const opportunitiesController = require('../controllers/opportunities.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', verifyToken, opportunitiesController.listOpportunities);
router.post('/', verifyToken, opportunitiesController.createOpportunity);
router.post('/:id/interest', verifyToken, opportunitiesController.submitInterest);

module.exports = router;

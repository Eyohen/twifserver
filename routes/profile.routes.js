const express = require('express');
const profileController = require('../controllers/profile.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { validate, validations } = require('../middleware/validate.middleware');

const router = express.Router();

router.get('/me', verifyToken, profileController.getCurrentProfile);

router.patch(
  '/personal',
  verifyToken,
  validations.personalProfile,
  validate,
  profileController.updatePersonalProfile
);

router.patch(
  '/business',
  verifyToken,
  validations.businessProfile,
  validate,
  profileController.updateBusinessProfile
);

module.exports = router;

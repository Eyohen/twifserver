const express = require('express');
const router = express.Router();
const lookupController = require('../controllers/lookup.controller');

// All lookup routes are public
// Locations
router.get('/regions', lookupController.getRegions);
router.get('/states', lookupController.getStates);
router.get('/states/:regionId', lookupController.getStatesByRegion);
router.get('/cities', lookupController.getCities);
router.get('/cities/:stateId', lookupController.getCitiesByState);

// Categories
router.get('/categories', lookupController.getCategories);
router.get('/categories/:id', lookupController.getCategoryById);

// Industries
router.get('/industries', lookupController.getIndustries);
router.get('/industries/:id', lookupController.getIndustryById);

// Tier configurations
router.get('/tiers/creator', lookupController.getCreatorTiers);
router.get('/tiers/brand', lookupController.getBrandTiers);

// Platform info
router.get('/platforms', lookupController.getPlatforms);
router.get('/content-types', lookupController.getContentTypes);

module.exports = router;

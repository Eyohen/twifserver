const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brand.controller');
const { verifyToken, requireBrand, requireOnboardingComplete } = require('../middleware/auth.middleware');
const { validate, validations } = require('../middleware/validate.middleware');

// All brand routes require authentication
router.use(verifyToken);

// Onboarding routes
router.get('/onboarding/status', requireBrand, brandController.getOnboardingStatus);
router.post('/onboarding/step/:step', requireBrand, brandController.saveOnboardingStep);
router.post('/onboarding/complete', requireBrand, brandController.completeOnboarding);

// Profile management
router.get('/profile/me', requireBrand, brandController.getMyProfile);
router.put('/profile', requireBrand, validations.brandProfile, validate, brandController.updateProfile);
router.put('/profile/logo', requireBrand, brandController.updateLogo);

// Saved creators (favorites)
router.get('/saved-creators', requireBrand, brandController.getSavedCreators);
router.post('/saved-creators/:creatorId', requireBrand, brandController.saveCreator);
router.delete('/saved-creators/:creatorId', requireBrand, brandController.unsaveCreator);
router.put('/saved-creators/:creatorId/notes', requireBrand, brandController.updateSavedCreatorNotes);

// Dashboard/Stats
router.get('/dashboard/stats', requireBrand, requireOnboardingComplete, brandController.getDashboardStats);
router.get('/dashboard/campaigns', requireBrand, requireOnboardingComplete, brandController.getCampaignStats);

// Usage limits (for tier-based features)
router.get('/usage', requireBrand, brandController.getUsageStats);

// Subscription/Tier management
router.get('/subscription', requireBrand, brandController.getSubscription);
router.post('/subscription/upgrade', requireBrand, brandController.initiateUpgrade);

module.exports = router;

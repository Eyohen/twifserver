const express = require('express');
const router = express.Router();
const creatorController = require('../controllers/creator.controller');
const { verifyToken, optionalAuth, requireCreator, requireOnboardingComplete } = require('../middleware/auth.middleware');
const { validate, validations } = require('../middleware/validate.middleware');

// Public routes - specific paths first
router.get('/', optionalAuth, creatorController.searchCreators);

// Protected routes - require authentication
// These need to be defined BEFORE the /:id route to avoid conflicts

// Onboarding routes
router.get('/onboarding/status', verifyToken, requireCreator, creatorController.getOnboardingStatus);
router.post('/onboarding/step/:step', verifyToken, requireCreator, creatorController.saveOnboardingStep);
router.post('/onboarding/complete', verifyToken, requireCreator, creatorController.completeOnboarding);

// Profile management
router.get('/profile/me', verifyToken, requireCreator, creatorController.getMyProfile);
router.put('/profile', verifyToken, requireCreator, validations.creatorProfile, validate, creatorController.updateProfile);
router.put('/profile/avatar', verifyToken, requireCreator, creatorController.updateAvatar);
router.put('/profile/cover', verifyToken, requireCreator, creatorController.updateCoverImage);

// Category management
router.get('/categories/my', verifyToken, requireCreator, creatorController.getMyCategories);
router.put('/categories', verifyToken, requireCreator, creatorController.updateCategories);

// Social accounts
router.get('/social-accounts', verifyToken, requireCreator, creatorController.getSocialAccounts);
router.post('/social-accounts', verifyToken, requireCreator, creatorController.addSocialAccount);
router.put('/social-accounts/:id', verifyToken, requireCreator, creatorController.updateSocialAccount);
router.delete('/social-accounts/:id', verifyToken, requireCreator, creatorController.deleteSocialAccount);

// Portfolio
router.get('/portfolio/my', verifyToken, requireCreator, creatorController.getMyPortfolio);
router.post('/portfolio', verifyToken, requireCreator, validations.portfolioItem, validate, creatorController.addPortfolioItem);
router.put('/portfolio/:id', verifyToken, requireCreator, creatorController.updatePortfolioItem);
router.delete('/portfolio/:id', verifyToken, requireCreator, creatorController.deletePortfolioItem);
router.put('/portfolio/reorder', verifyToken, requireCreator, creatorController.reorderPortfolio);

// Rate cards
router.get('/rate-cards/my', verifyToken, requireCreator, creatorController.getMyRateCards);
router.post('/rate-cards', verifyToken, requireCreator, validations.rateCard, validate, creatorController.addRateCard);
router.put('/rate-cards/:id', verifyToken, requireCreator, creatorController.updateRateCard);
router.delete('/rate-cards/:id', verifyToken, requireCreator, creatorController.deleteRateCard);

// Service packages
router.get('/packages/my', verifyToken, requireCreator, creatorController.getMyPackages);
router.post('/packages', verifyToken, requireCreator, creatorController.addPackage);
router.put('/packages/:id', verifyToken, requireCreator, creatorController.updatePackage);
router.delete('/packages/:id', verifyToken, requireCreator, creatorController.deletePackage);

// Availability
router.get('/availability/my', verifyToken, requireCreator, creatorController.getMyAvailability);
router.put('/availability', verifyToken, requireCreator, creatorController.updateAvailability);
router.post('/availability/slots', verifyToken, requireCreator, creatorController.addAvailabilitySlot);
router.delete('/availability/slots/:id', verifyToken, requireCreator, creatorController.deleteAvailabilitySlot);

// Legal clauses
router.get('/legal-clauses/my', verifyToken, requireCreator, creatorController.getMyLegalClauses);
router.post('/legal-clauses', verifyToken, requireCreator, creatorController.addLegalClause);
router.put('/legal-clauses/:id', verifyToken, requireCreator, creatorController.updateLegalClause);
router.delete('/legal-clauses/:id', verifyToken, requireCreator, creatorController.deleteLegalClause);

// Dashboard/Stats
router.get('/dashboard', verifyToken, requireCreator, creatorController.getDashboard);
router.get('/dashboard/stats', verifyToken, requireCreator, requireOnboardingComplete, creatorController.getDashboardStats);
router.get('/dashboard/earnings', verifyToken, requireCreator, requireOnboardingComplete, creatorController.getEarningsStats);

// Public routes with :id parameter - MUST be LAST to avoid catching other routes
router.get('/:id', optionalAuth, creatorController.getCreatorPublicProfile);
router.get('/:id/portfolio', creatorController.getCreatorPortfolio);
router.get('/:id/reviews', creatorController.getCreatorReviews);
router.get('/:id/rate-cards', creatorController.getCreatorRateCards);
router.get('/:id/availability', creatorController.getCreatorAvailability);

module.exports = router;

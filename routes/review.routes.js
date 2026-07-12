const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { verifyToken, requireOnboardingComplete } = require('../middleware/auth.middleware');
const { validate, validations } = require('../middleware/validate.middleware');

router.use(verifyToken);
router.use(requireOnboardingComplete);

// Create review for a completed collaboration
router.post('/request/:requestId',
  validations.review,
  validate,
  reviewController.createReview
);

// Get review for a request
router.get('/request/:requestId', reviewController.getReviewByRequest);

// Respond to a review (creator only)
router.post('/:id/respond', reviewController.respondToReview);

// Get my reviews (as reviewer)
router.get('/given', reviewController.getGivenReviews);

// Get reviews about me
router.get('/received', reviewController.getReceivedReviews);

module.exports = router;

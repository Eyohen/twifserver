const db = require('../models');
const { Review, CollaborationRequest, Creator, Brand } = db;

// Create review
exports.createReview = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.userId;

    const request = await CollaborationRequest.findByPk(requestId);
    if (!request || request.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot review this request' });
    }

    // Determine reviewer and reviewee
    const creator = await Creator.findOne({ where: { userId } });
    const brand = await Brand.findOne({ where: { userId } });

    let reviewerId, revieweeId, reviewerType;

    if (brand && brand.id === request.brandId) {
      reviewerId = brand.id;
      revieweeId = request.creatorId;
      reviewerType = 'brand';
    } else if (creator && creator.id === request.creatorId) {
      reviewerId = creator.id;
      revieweeId = request.brandId;
      reviewerType = 'creator';
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Check if already reviewed
    const existing = await Review.findOne({ where: { requestId, reviewerId } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Already reviewed' });
    }

    const review = await Review.create({
      requestId,
      reviewerId,
      revieweeId,
      reviewerType,
      rating: req.body.rating,
      comment: req.body.comment,
      communicationRating: req.body.communicationRating,
      qualityRating: req.body.qualityRating,
      professionalismRating: req.body.professionalismRating,
      timelinessRating: req.body.timelinessRating
    });

    // Update reviewee's average rating
    if (reviewerType === 'brand') {
      const creator = await Creator.findByPk(revieweeId);
      const reviews = await Review.findAll({ where: { revieweeId } });
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      await creator.update({ averageRating: avgRating, totalReviews: reviews.length });
    }

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ success: false, message: 'Failed to create review' });
  }
};

// Get review by request
exports.getReviewByRequest = async (req, res) => {
  try {
    const reviews = await Review.findAll({
      where: { requestId: req.params.requestId }
    });
    res.json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get review' });
  }
};

// Respond to review
exports.respondToReview = async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Not found' });

    // Only reviewee can respond
    const creator = await Creator.findOne({ where: { userId: req.userId } });
    if (!creator || creator.id !== review.revieweeId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (review.response) {
      return res.status(400).json({ success: false, message: 'Already responded' });
    }

    await review.update({ response: req.body.response, respondedAt: new Date() });
    res.json({ success: true, message: 'Response added' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to respond' });
  }
};

// Get given reviews
exports.getGivenReviews = async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { userId: req.userId } });
    const brand = await Brand.findOne({ where: { userId: req.userId } });
    const reviewerId = creator?.id || brand?.id;

    const reviews = await Review.findAll({
      where: { reviewerId },
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get reviews' });
  }
};

// Get received reviews
exports.getReceivedReviews = async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { userId: req.userId } });
    const brand = await Brand.findOne({ where: { userId: req.userId } });
    const revieweeId = creator?.id || brand?.id;

    const reviews = await Review.findAll({
      where: { revieweeId },
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get reviews' });
  }
};

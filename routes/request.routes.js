const express = require('express');
const router = express.Router();
const requestController = require('../controllers/request.controller');
const { verifyToken, requireCreator, requireBrand, requireOnboardingComplete } = require('../middleware/auth.middleware');
const { validate, validations } = require('../middleware/validate.middleware');

router.use(verifyToken);

// Brand routes
router.post('/',
  requireBrand,
  requireOnboardingComplete,
  validations.collaborationRequest,
  validate,
  requestController.createRequest
);

router.get('/brand/sent', requireBrand, requestController.getBrandRequests);
router.get('/brand/:id', requireBrand, requestController.getBrandRequestDetail);
router.put('/brand/:id/cancel', requireBrand, requestController.cancelRequest);
router.put('/brand/:id/approve-content', requireBrand, requestController.approveContent);
router.put('/brand/:id/request-revision', requireBrand, requestController.requestRevision);
router.put('/brand/:id/complete', requireBrand, requestController.completeCollaboration);

// Creator routes
router.get('/creator/received', requireCreator, requestController.getCreatorRequests);
router.get('/creator/:id', requireCreator, requestController.getCreatorRequestDetail);
router.put('/creator/:id/accept', requireCreator, requestController.acceptRequest);
router.put('/creator/:id/decline', requireCreator, requestController.declineRequest);
router.put('/creator/:id/counter-offer', requireCreator, requestController.sendCounterOffer);
router.put('/creator/:id/submit-content', requireCreator, requestController.submitContent);

// Shared routes
router.get('/:id', requestController.getRequestDetail);
router.get('/:id/timeline', requestController.getRequestTimeline);
router.get('/:id/negotiations', requestController.getNegotiationHistory);

module.exports = router;

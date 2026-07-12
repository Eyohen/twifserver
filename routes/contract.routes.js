const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contract.controller');
const { verifyToken, requireOnboardingComplete } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.use(requireOnboardingComplete);

// Get contract for a request
router.get('/request/:requestId', contractController.getContractByRequest);

// Get contract by ID
router.get('/:id', contractController.getContractById);

// Sign contract
router.post('/:id/sign', contractController.signContract);

// Download contract as PDF
router.get('/:id/download', contractController.downloadContract);

// Get my contracts
router.get('/', contractController.getMyContracts);

module.exports = router;

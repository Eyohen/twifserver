const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { verifyToken, requireCreator, requireBrand, requireOnboardingComplete } = require('../middleware/auth.middleware');
const { validate, validations } = require('../middleware/validate.middleware');

router.use(verifyToken);
router.use(requireOnboardingComplete);

// Brand payment routes
router.post('/initialize', requireBrand, paymentController.initializePayment);
router.get('/verify/:reference', paymentController.verifyPayment);

// Escrow status (accessible by both brand and creator)
router.get('/escrow/:requestId', paymentController.getEscrowStatus);

// Creator payout routes
router.get('/earnings', requireCreator, paymentController.getEarnings);
router.get('/transactions', paymentController.getTransactions);
router.post('/payout/request', requireCreator, validations.payoutRequest, validate, paymentController.requestPayout);
router.get('/payouts', requireCreator, paymentController.getPayoutHistory);

// Bank account management
router.get('/bank-accounts', requireCreator, paymentController.getBankAccounts);
router.post('/bank-accounts', requireCreator, validations.bankAccount, validate, paymentController.addBankAccount);
router.put('/bank-accounts/:id/primary', requireCreator, paymentController.setPrimaryBankAccount);
router.delete('/bank-accounts/:id', requireCreator, paymentController.deleteBankAccount);

// Get list of banks (Paystack)
router.get('/banks', paymentController.getBankList);

// Verify bank account (Paystack)
router.post('/bank-accounts/verify', requireCreator, paymentController.verifyBankAccount);

module.exports = router;

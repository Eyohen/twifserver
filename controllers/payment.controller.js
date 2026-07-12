const crypto = require('crypto');
const db = require('../models');
const { Payment, Payout, BankAccount, Creator, Brand, CollaborationRequest } = db;
const paystackService = require('../services/paystack.service');

// Platform fee percentage (10%)
const PLATFORM_FEE_PERCENTAGE = 0.10;

// Initialize payment (Brand pays to escrow)
exports.initializePayment = async (req, res) => {
  try {
    console.log('=== PAYMENT INITIALIZATION STARTED ===');
    console.log('Request body:', req.body);

    const { requestId, amount } = req.body;
    const brand = req.brand;

    console.log('Brand:', brand?.id, brand?.companyName);
    console.log('RequestId:', requestId);
    console.log('Amount:', amount);

    const request = await CollaborationRequest.findByPk(requestId, {
      include: [{ model: Creator, as: 'creator' }]
    });

    console.log('Found request:', request?.id, 'Status:', request?.status);

    if (!request || request.brandId !== brand.id) {
      console.log('Request not found or brand mismatch');
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Only allow payment for accepted requests
    if (request.status !== 'accepted' && request.status !== 'contract_signed') {
      console.log('Invalid request status:', request.status);
      return res.status(400).json({
        success: false,
        message: 'Request must be accepted before payment'
      });
    }

    // Check if payment already exists for this request
    const existingPayment = await Payment.findOne({
      where: { requestId, status: ['escrow', 'completed', 'released'] }
    });

    console.log('Existing payment:', existingPayment?.id);

    if (existingPayment) {
      console.log('Payment already exists');
      return res.status(400).json({
        success: false,
        message: 'Payment already made for this request'
      });
    }

    const reference = `CW-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    console.log('Generated reference:', reference);

    // Calculate platform fee
    const platformFee = Math.round(amount * PLATFORM_FEE_PERCENTAGE);
    const creatorPayout = amount - platformFee;
    console.log('Platform fee:', platformFee, 'Creator payout:', creatorPayout);

    console.log('Calling Paystack initializeTransaction...');
    const result = await paystackService.initializeTransaction({
      email: req.user.email,
      amount: amount * 100, // Convert to kobo
      reference,
      callback_url: `${process.env.FRONTEND_URL}/payment/verify`,
      metadata: {
        requestId,
        brandId: brand.id,
        creatorId: request.creatorId,
        platformFee,
        creatorPayout
      }
    });
    console.log('Paystack response:', result);

    // Create payment record with escrow details
    console.log('Creating payment record...');
    const payment = await Payment.create({
      referenceNumber: reference,
      requestId,
      brandId: brand.id,
      creatorId: request.creatorId,
      amount,
      platformFee,
      platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
      creatorPayout,
      currency: 'NGN',
      paymentMethod: 'paystack',
      paystackReference: reference,
      status: 'pending'
    });
    console.log('Payment created:', payment.id);
    console.log('=== PAYMENT INITIALIZATION COMPLETE ===');

    res.json({
      success: true,
      data: {
        authorizationUrl: result.authorization_url,
        accessCode: result.access_code,
        reference
      }
    });
  } catch (error) {
    console.error('=== PAYMENT INITIALIZATION ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ success: false, message: 'Failed to initialize payment' });
  }
};

// Verify payment and move to escrow
exports.verifyPayment = async (req, res) => {
  try {
    console.log('=== PAYMENT VERIFICATION STARTED ===');
    const { reference } = req.params;
    console.log('Reference:', reference);

    console.log('Calling Paystack verifyTransaction...');
    const result = await paystackService.verifyTransaction(reference);
    console.log('Paystack verification result:', result?.status, result?.gateway_response);

    console.log('Looking up payment in database...');
    const payment = await Payment.findOne({
      where: { paystackReference: reference },
      include: [
        { model: Creator, as: 'creator' },
        { model: CollaborationRequest, as: 'request' }
      ]
    });

    console.log('Payment found:', payment?.id, 'Status:', payment?.status);

    if (!payment) {
      console.log('Payment not found in database');
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (result.status === 'success') {
      console.log('Payment successful, moving to escrow...');

      // Move payment to escrow status
      await payment.update({
        status: 'escrow',
        escrowAt: new Date(),
        paystackTransactionId: result.id,
        paymentChannel: result.channel,
        paidAt: new Date()
      });
      console.log('Payment status updated to escrow');

      // Update creator's pending earnings
      console.log('Incrementing creator pending earnings by:', payment.creatorPayout);
      await Creator.increment('pendingEarnings', {
        by: payment.creatorPayout,
        where: { id: payment.creatorId }
      });
      console.log('Creator pending earnings updated');

      // Update request status to in_progress
      console.log('Updating request status to in_progress...');
      await CollaborationRequest.update(
        {
          status: 'in_progress',
          paymentCompletedAt: new Date()
        },
        { where: { id: payment.requestId } }
      );
      console.log('Request status updated');

      console.log(`✅ Payment ${reference} moved to escrow. Creator pending: +₦${payment.creatorPayout}`);
      console.log('=== PAYMENT VERIFICATION COMPLETE ===');

      res.json({
        success: true,
        data: {
          status: 'escrow',
          message: 'Payment successful. Funds are now held in escrow.',
          escrowAmount: payment.amount,
          creatorWillReceive: payment.creatorPayout
        }
      });
    } else {
      console.log('Payment failed:', result.gateway_response);
      await payment.update({ status: 'failed', failureReason: result.gateway_response });
      res.json({
        success: false,
        data: { status: 'failed', message: result.gateway_response }
      });
    }
  } catch (error) {
    console.error('=== PAYMENT VERIFICATION ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
};

// Handle Paystack webhook
exports.handlePaystackWebhook = async (req, res) => {
  try {
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const event = req.body;
    console.log('📨 Paystack webhook received:', event.event);

    // Handle payment success
    if (event.event === 'charge.success') {
      const { reference } = event.data;
      const payment = await Payment.findOne({
        where: { paystackReference: reference }
      });

      if (payment && payment.status === 'pending') {
        await payment.update({
          status: 'escrow',
          escrowAt: new Date(),
          paystackTransactionId: event.data.id,
          paymentChannel: event.data.channel,
          paidAt: new Date()
        });

        // Update creator's pending earnings
        await Creator.increment('pendingEarnings', {
          by: payment.creatorPayout,
          where: { id: payment.creatorId }
        });

        await CollaborationRequest.update(
          { status: 'in_progress', paymentCompletedAt: new Date() },
          { where: { id: payment.requestId } }
        );

        console.log(`✅ Webhook: Payment ${reference} moved to escrow`);
      }
    }

    // Handle transfer success (payout to creator)
    if (event.event === 'transfer.success') {
      const { reference, transfer_code } = event.data;
      const payout = await Payout.findOne({
        where: { paystackTransferCode: transfer_code }
      });

      if (payout && payout.status === 'processing') {
        await payout.update({
          status: 'completed',
          completedAt: new Date()
        });
        console.log(`✅ Webhook: Payout ${reference} completed`);
      }
    }

    // Handle transfer failure
    if (event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
      const { transfer_code, reason } = event.data;
      const payout = await Payout.findOne({
        where: { paystackTransferCode: transfer_code }
      });

      if (payout && payout.status === 'processing') {
        await payout.update({
          status: 'failed',
          failureReason: reason || 'Transfer failed'
        });

        // Refund the creator's available balance
        await Creator.increment('availableBalance', {
          by: payout.amount,
          where: { id: payout.creatorId }
        });

        console.log(`❌ Webhook: Payout ${transfer_code} failed. Balance refunded.`);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
};

// Release escrow (called when brand approves content)
exports.releaseEscrow = async (paymentId, releasedById) => {
  const payment = await Payment.findByPk(paymentId, {
    include: [{ model: Creator, as: 'creator' }]
  });

  if (!payment || payment.status !== 'escrow') {
    throw new Error('Payment not in escrow');
  }

  // Update payment status
  await payment.update({
    status: 'released',
    escrowReleasedAt: new Date(),
    escrowReleasedBy: releasedById,
    releaseType: 'manual',
    completedAt: new Date()
  });

  // Move funds from pending to available for creator
  const creator = await Creator.findByPk(payment.creatorId);

  await creator.update({
    pendingEarnings: Math.max(0, (creator.pendingEarnings || 0) - payment.creatorPayout),
    availableBalance: (creator.availableBalance || 0) + payment.creatorPayout,
    totalEarnings: (creator.totalEarnings || 0) + payment.creatorPayout
  });

  console.log(`✅ Escrow released for payment ${paymentId}. Creator available: +₦${payment.creatorPayout}`);

  return payment;
};

// Get escrow status for a request
exports.getEscrowStatus = async (req, res) => {
  try {
    const { requestId } = req.params;

    const payment = await Payment.findOne({
      where: { requestId },
      include: [
        { model: Creator, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
        { model: Brand, as: 'brand', attributes: ['id', 'companyName'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    if (!payment) {
      return res.json({
        success: true,
        data: {
          hasPayment: false,
          status: null
        }
      });
    }

    res.json({
      success: true,
      data: {
        hasPayment: true,
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
        platformFee: payment.platformFee,
        creatorPayout: payment.creatorPayout,
        currency: payment.currency,
        escrowAt: payment.escrowAt,
        escrowReleasedAt: payment.escrowReleasedAt,
        releaseType: payment.releaseType,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt
      }
    });
  } catch (error) {
    console.error('Get escrow status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get escrow status' });
  }
};

// Get earnings (Creator)
exports.getEarnings = async (req, res) => {
  try {
    const creator = req.creator;

    // Get counts for additional context
    const completedPayments = await Payment.count({
      where: { creatorId: creator.id, status: ['released', 'completed'] }
    });

    const escrowPayments = await Payment.count({
      where: { creatorId: creator.id, status: 'escrow' }
    });

    res.json({
      success: true,
      data: {
        totalEarnings: creator.totalEarnings || 0,
        availableBalance: creator.availableBalance || 0,
        pendingEarnings: creator.pendingEarnings || 0,
        completedPayments,
        escrowPayments
      }
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ success: false, message: 'Failed to get earnings' });
  }
};

// Get transactions
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.userId;
    const creator = await Creator.findOne({ where: { userId } });
    const brand = await Brand.findOne({ where: { userId } });

    const where = {};
    if (creator) where.creatorId = creator.id;
    else if (brand) where.brandId = brand.id;

    const payments = await Payment.findAll({
      where,
      include: [
        { model: CollaborationRequest, as: 'request', attributes: ['id', 'title', 'referenceNumber'] },
        { model: Creator, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
        { model: Brand, as: 'brand', attributes: ['id', 'companyName'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.json({ success: true, data: payments });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ success: false, message: 'Failed to get transactions' });
  }
};

// Request payout (Creator)
exports.requestPayout = async (req, res) => {
  try {
    const creator = req.creator;
    const { amount, bankAccountId } = req.body;

    // Minimum payout amount
    const MIN_PAYOUT = 5000;
    if (amount < MIN_PAYOUT) {
      return res.status(400).json({
        success: false,
        message: `Minimum payout amount is ₦${MIN_PAYOUT.toLocaleString()}`
      });
    }

    if (amount > (creator.availableBalance || 0)) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const bankAccount = await BankAccount.findOne({
      where: { id: bankAccountId, userId: req.userId }
    });

    if (!bankAccount) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }

    // Ensure bank account has Paystack recipient code
    let recipientCode = bankAccount.paystackRecipientCode;

    if (!recipientCode) {
      // Create Paystack transfer recipient
      const recipient = await paystackService.createTransferRecipient({
        name: bankAccount.accountName,
        accountNumber: bankAccount.accountNumber,
        bankCode: bankAccount.bankCode
      });

      recipientCode = recipient.recipient_code;

      // Save recipient code to bank account
      await bankAccount.update({
        paystackRecipientCode: recipientCode,
        verified: true,
        verifiedAt: new Date()
      });
    }

    // Generate payout reference
    const payoutReference = `CW-PO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Initiate Paystack transfer
    const transfer = await paystackService.initiateTransfer({
      amount: amount * 100, // Convert to kobo
      recipientCode,
      reason: 'CreatorsWorld earnings payout',
      reference: payoutReference
    });

    // Create payout record
    const payout = await Payout.create({
      creatorId: creator.id,
      bankAccountId,
      amount,
      currency: 'NGN',
      referenceNumber: payoutReference,
      paystackTransferCode: transfer.transfer_code,
      paystackRecipientCode: recipientCode,
      status: 'processing',
      bankName: bankAccount.bankName,
      accountNumber: bankAccount.accountNumber,
      accountName: bankAccount.accountName
    });

    // Deduct from available balance immediately
    await creator.decrement('availableBalance', { by: amount });

    console.log(`💸 Payout initiated: ${payoutReference} - ₦${amount.toLocaleString()}`);

    res.json({
      success: true,
      message: 'Payout initiated successfully',
      data: {
        id: payout.id,
        reference: payoutReference,
        amount,
        status: 'processing',
        estimatedArrival: '1-3 business days'
      }
    });
  } catch (error) {
    console.error('Request payout error:', error);
    res.status(500).json({ success: false, message: 'Failed to request payout' });
  }
};

// Get payout history (Creator)
exports.getPayoutHistory = async (req, res) => {
  try {
    const payouts = await Payout.findAll({
      where: { creatorId: req.creator.id },
      include: [{ model: BankAccount, as: 'bankAccount' }],
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, data: payouts });
  } catch (error) {
    console.error('Get payouts error:', error);
    res.status(500).json({ success: false, message: 'Failed to get payouts' });
  }
};

// Get bank accounts
exports.getBankAccounts = async (req, res) => {
  try {
    const accounts = await BankAccount.findAll({
      where: { userId: req.userId },
      order: [['isDefault', 'DESC'], ['createdAt', 'DESC']]
    });
    res.json({ success: true, data: accounts });
  } catch (error) {
    console.error('Get bank accounts error:', error);
    res.status(500).json({ success: false, message: 'Failed to get accounts' });
  }
};

// Add bank account
exports.addBankAccount = async (req, res) => {
  try {
    const { bankCode, bankName, accountNumber, accountName } = req.body;

    // Validate account number
    if (!/^\d{10}$/.test(accountNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Account number must be 10 digits'
      });
    }

    // Check if account already exists
    const existing = await BankAccount.findOne({
      where: { userId: req.userId, accountNumber, bankCode }
    });

    if (existing) {
      return res.status(409).json({ success: false, message: 'Account already exists' });
    }

    // Check if this is first account (make it default)
    const count = await BankAccount.count({ where: { userId: req.userId } });

    const account = await BankAccount.create({
      userId: req.userId,
      bankCode,
      bankName,
      accountNumber,
      accountName,
      isDefault: count === 0,
      verified: true,
      verifiedAt: new Date()
    });

    res.status(201).json({ success: true, data: account });
  } catch (error) {
    console.error('Add bank account error:', error);
    res.status(500).json({ success: false, message: 'Failed to add account' });
  }
};

// Set default bank account
exports.setPrimaryBankAccount = async (req, res) => {
  try {
    // Unset all others
    await BankAccount.update(
      { isDefault: false },
      { where: { userId: req.userId } }
    );
    // Set this one as default
    const [updated] = await BankAccount.update(
      { isDefault: true },
      { where: { id: req.params.id, userId: req.userId } }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    res.json({ success: true, message: 'Default account updated' });
  } catch (error) {
    console.error('Set default account error:', error);
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

// Delete bank account
exports.deleteBankAccount = async (req, res) => {
  try {
    const account = await BankAccount.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!account) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    if (account.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete default account. Set another as default first.'
      });
    }

    await account.destroy();
    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    console.error('Delete bank account error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
};

// Get bank list (Paystack)
exports.getBankList = async (req, res) => {
  try {
    const banks = await paystackService.getBanks();
    res.json({ success: true, data: banks });
  } catch (error) {
    console.error('Get banks error:', error);
    res.status(500).json({ success: false, message: 'Failed to get banks' });
  }
};

// Verify bank account
exports.verifyBankAccount = async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;

    if (!/^\d{10}$/.test(accountNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Account number must be 10 digits'
      });
    }

    const result = await paystackService.resolveAccount(accountNumber, bankCode);
    res.json({
      success: true,
      data: {
        accountName: result.account_name,
        accountNumber: result.account_number,
        bankId: result.bank_id
      }
    });
  } catch (error) {
    console.error('Verify bank account error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not verify account. Please check the details and try again.'
    });
  }
};

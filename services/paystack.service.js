const axios = require('axios');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const paystackApi = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  }
});

module.exports = {
  // Initialize a transaction
  initializeTransaction: async ({ email, amount, reference, callback_url, metadata }) => {
    try {
      const response = await paystackApi.post('/transaction/initialize', {
        email,
        amount, // Amount in kobo (Naira x 100)
        reference,
        callback_url,
        metadata,
        currency: 'NGN'
      });
      return response.data.data;
    } catch (error) {
      console.error('Paystack initialize error:', error.response?.data || error.message);
      throw new Error('Failed to initialize payment');
    }
  },

  // Verify a transaction
  verifyTransaction: async (reference) => {
    try {
      const response = await paystackApi.get(`/transaction/verify/${reference}`);
      return response.data.data;
    } catch (error) {
      console.error('Paystack verify error:', error.response?.data || error.message);
      throw new Error('Failed to verify payment');
    }
  },

  // Get list of banks
  getBanks: async () => {
    try {
      const response = await paystackApi.get('/bank?country=nigeria');
      return response.data.data;
    } catch (error) {
      console.error('Paystack banks error:', error.response?.data || error.message);
      throw new Error('Failed to fetch banks');
    }
  },

  // Resolve account number
  resolveAccount: async (accountNumber, bankCode) => {
    try {
      const response = await paystackApi.get('/bank/resolve', {
        params: { account_number: accountNumber, bank_code: bankCode }
      });
      return response.data.data;
    } catch (error) {
      console.error('Paystack resolve error:', error.response?.data || error.message);
      throw new Error('Failed to resolve account');
    }
  },

  // Create transfer recipient
  createTransferRecipient: async ({ name, accountNumber, bankCode }) => {
    try {
      const response = await paystackApi.post('/transferrecipient', {
        type: 'nuban',
        name,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'NGN'
      });
      return response.data.data;
    } catch (error) {
      console.error('Paystack recipient error:', error.response?.data || error.message);
      throw new Error('Failed to create recipient');
    }
  },

  // Initiate transfer (payout)
  initiateTransfer: async ({ amount, recipientCode, reason, reference }) => {
    try {
      const response = await paystackApi.post('/transfer', {
        source: 'balance',
        amount, // Amount in kobo
        recipient: recipientCode,
        reason,
        reference
      });
      return response.data.data;
    } catch (error) {
      console.error('Paystack transfer error:', error.response?.data || error.message);
      throw new Error('Failed to initiate transfer');
    }
  },

  // Get transfer status
  getTransfer: async (transferCode) => {
    try {
      const response = await paystackApi.get(`/transfer/${transferCode}`);
      return response.data.data;
    } catch (error) {
      console.error('Paystack get transfer error:', error.response?.data || error.message);
      throw new Error('Failed to get transfer');
    }
  },

  // Get account balance
  getBalance: async () => {
    try {
      const response = await paystackApi.get('/balance');
      return response.data.data;
    } catch (error) {
      console.error('Paystack balance error:', error.response?.data || error.message);
      throw new Error('Failed to get balance');
    }
  },

  // Create subscription plan
  createPlan: async ({ name, amount, interval }) => {
    try {
      const response = await paystackApi.post('/plan', {
        name,
        amount,
        interval // 'daily', 'weekly', 'monthly', 'annually'
      });
      return response.data.data;
    } catch (error) {
      console.error('Paystack plan error:', error.response?.data || error.message);
      throw new Error('Failed to create plan');
    }
  },

  // Create subscription
  createSubscription: async ({ customer, plan, startDate }) => {
    try {
      const response = await paystackApi.post('/subscription', {
        customer,
        plan,
        start_date: startDate
      });
      return response.data.data;
    } catch (error) {
      console.error('Paystack subscription error:', error.response?.data || error.message);
      throw new Error('Failed to create subscription');
    }
  },

  // Disable subscription
  disableSubscription: async ({ code, emailToken }) => {
    try {
      const response = await paystackApi.post('/subscription/disable', {
        code,
        token: emailToken
      });
      return response.data.data;
    } catch (error) {
      console.error('Paystack disable subscription error:', error.response?.data || error.message);
      throw new Error('Failed to disable subscription');
    }
  }
};

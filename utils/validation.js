// src/utils/validation.js
const ethers = require('ethers');

const validateMerchant = (data) => {
  const { businessName, walletAddress, webhookUrl } = data;

  if (!businessName || typeof businessName !== 'string') {
    return 'Business name is required and must be a string';
  }

  if (!walletAddress) {
    return 'Wallet address is required';
  }

  // Validate Ethereum address
  try {
    if (!ethers.isAddress(walletAddress)) {
      return 'Invalid wallet address format';
    }
  } catch (error) {
    return 'Invalid wallet address';
  }

  if (!webhookUrl) {
    return 'Webhook URL is required';
  }

  try {
    new URL(webhookUrl);
  } catch (error) {
    return 'Invalid webhook URL format';
  }

  return null;
};

const validatePayment = (data) => {
  const { amount, tokenId } = data;

  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    return 'Amount must be a positive number';
  }

  if (!tokenId) {
    return 'Token ID is required';
  }

  return null;
};

const validateTransaction = (data) => {
  const { txHash, chainId, network } = data;

  if (!txHash || typeof txHash !== 'string') {
    return 'Transaction hash is required and must be a string';
  }

  // Check if this is a Solana transaction (base58, 87-88 chars)
  const isSolana = network === 'solana' || chainId === '103' || chainId === 103;
  const isEvmHash = /^0x[a-fA-F0-9]{64}$/.test(txHash);
  const isSolanaSignature = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(txHash);

  if (isSolana) {
    // Solana transaction signature validation
    if (!isSolanaSignature) {
      return 'Invalid Solana transaction signature format';
    }
  } else {
    // EVM transaction hash validation (0x followed by 64 hexadecimal characters)
    if (!isEvmHash) {
      return 'Invalid transaction hash format';
    }
  }

  if (!chainId && !network) {
    return 'Network ID is required';
  }

  return null;
};

module.exports = {
  validateMerchant,
  validatePayment,
  validateTransaction
};
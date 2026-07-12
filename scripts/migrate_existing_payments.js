// scripts/migrate_existing_payments.js
const db = require('../models');
const { Payment, Network, Token } = db;

async function migrateExistingPayments() {
  try {
    // Get Ethereum network ID
    const ethereumNetwork = await Network.findOne({ 
      where: { shortName: 'ethereum' } 
    });
    
    if (!ethereumNetwork) {
      throw new Error('Ethereum network not found');
    }
    
    // Get default tokens
    const usdtToken = await Token.findOne({
      where: {
        symbol: 'USDT',
        networkId: ethereumNetwork.id
      }
    });
    
    const usdcToken = await Token.findOne({
      where: {
        symbol: 'USDC',
        networkId: ethereumNetwork.id
      }
    });
    
    const bnbToken = await Token.findOne({
      where: {
        symbol: 'BNB',
        networkId: ethereumNetwork.id
      }
    });
    
    // Update existing payments
    const payments = await Payment.findAll({
      where: {
        networkId: null
      }
    });
    
    console.log(`Found ${payments.length} payments to migrate`);
    
    for (const payment of payments) {
      let tokenId = null;
      
      // Map currency to token
      switch(payment.currency) {
        case 'USDT':
          tokenId = usdtToken?.id;
          break;
        case 'USDC':
          tokenId = usdcToken?.id;
          break;
        case 'BNB':
          tokenId = bnbToken?.id;
          break;
        default:
          tokenId = usdtToken?.id; // Default to USDT
      }
      
      await payment.update({
        networkId: ethereumNetwork.id,
        tokenId: tokenId
      });
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
  }
}

// Run the migration
migrateExistingPayments();
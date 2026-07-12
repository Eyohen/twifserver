// scripts/simple-network-diagnostic.js
// Quick diagnostic to check network/payment mismatch

const db = require("../models");
const { Payment, Network, Token } = db;

const runDiagnostic = async () => {
  try {
    console.log('🔍 QUICK NETWORK DIAGNOSTIC\n');

    // 1. Check what networks exist
    console.log('1. Available networks:');
    const networks = await Network.findAll({
      attributes: ['id', 'name', 'shortName', 'status'],
      where: { status: 'active' }
    });
    
    networks.forEach(network => {
      console.log(`   ${network.shortName} -> ${network.name} (${network.id})`);
    });

    // 2. Check recent payments and their networks
    console.log('\n2. Last 5 payments with network info:');
    const payments = await Payment.findAll({
      limit: 5,
      include: [
        {
          model: Network,
          attributes: ['name', 'shortName'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    payments.forEach(payment => {
      console.log(`   Payment ${payment.id.substring(0, 8)}: networkId=${payment.networkId} -> ${payment.Network?.name || 'NO_NETWORK'} (${payment.Network?.shortName || 'NO_SHORT_NAME'})`);
    });

    // 3. Test the exact lookup that createPayment uses
    console.log('\n3. Testing network lookup for "solana":');
    const solanaLookup = await Network.findOne({
      where: { 
        shortName: 'solana',
        status: 'active'
      }
    });

    if (solanaLookup) {
      console.log(`   ✅ Found: ${solanaLookup.name} (ID: ${solanaLookup.id})`);
    } else {
      console.log(`   ❌ NOT FOUND! Networks with "solana" in shortName:`);
      const solanaLike = await Network.findAll({
        where: {
          shortName: {
            [db.Sequelize.Op.iLike]: '%solana%'
          }
        }
      });
      solanaLike.forEach(net => {
        console.log(`      Found: "${net.shortName}" -> ${net.name}`);
      });
    }

    // 4. Test Ethereum lookup
    console.log('\n4. Testing network lookup for "ethereum":');
    const ethereumLookup = await Network.findOne({
      where: { 
        shortName: 'ethereum',
        status: 'active'
      }
    });

    if (ethereumLookup) {
      console.log(`   ✅ Found: ${ethereumLookup.name} (ID: ${ethereumLookup.id})`);
    } else {
      console.log(`   ❌ Ethereum NOT FOUND!`);
    }

    console.log('\n✅ Diagnostic complete!');

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  } finally {
    process.exit(0);
  }
};

runDiagnostic();
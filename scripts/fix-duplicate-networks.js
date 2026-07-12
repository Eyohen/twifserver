// scripts/fix-duplicate-networks.js
// This script will clean up your duplicate networks and fix the payment associations

const db = require("../models");
const { Payment, Network, Token } = db;

const fixDuplicateNetworks = async () => {
  try {
    console.log('🔧 Fixing duplicate networks...\n');

    // 1. First, let's see what we have
    console.log('1. Current network duplicates:');
    const allNetworks = await Network.findAll({
      attributes: ['id', 'name', 'shortName', 'type', 'createdAt'],
      order: [['shortName', 'ASC'], ['createdAt', 'ASC']]
    });

    const networkGroups = {};
    allNetworks.forEach(network => {
      if (!networkGroups[network.shortName]) {
        networkGroups[network.shortName] = [];
      }
      networkGroups[network.shortName].push(network);
    });

    Object.keys(networkGroups).forEach(shortName => {
      console.log(`\n   ${shortName}:`);
      networkGroups[shortName].forEach((network, index) => {
        console.log(`     ${index + 1}. ${network.id} - ${network.name} (created: ${network.createdAt})`);
      });
    });

    // 2. Keep the oldest network for each shortName and prepare to delete duplicates
    console.log('\n2. Choosing networks to keep (oldest for each shortName):');
    const networksToKeep = {};
    const networksToDelete = [];

    Object.keys(networkGroups).forEach(shortName => {
      const networks = networkGroups[shortName];
      if (networks.length > 1) {
        // Keep the oldest one (first in sorted array)
        const keepNetwork = networks[0];
        const deleteNetworks = networks.slice(1);
        
        networksToKeep[shortName] = keepNetwork;
        networksToDelete.push(...deleteNetworks);
        
        console.log(`   ✅ Keep: ${keepNetwork.id} - ${keepNetwork.name}`);
        deleteNetworks.forEach(network => {
          console.log(`   ❌ Delete: ${network.id} - ${network.name}`);
        });
      } else {
        networksToKeep[shortName] = networks[0];
        console.log(`   ✅ Keep: ${networks[0].id} - ${networks[0].name} (no duplicates)`);
      }
    });

    // 3. Update payments that reference networks to be deleted
    console.log('\n3. Updating payment references:');
    for (const networkToDelete of networksToDelete) {
      const keepNetwork = networksToKeep[networkToDelete.shortName];
      
      console.log(`\n   Updating payments from ${networkToDelete.shortName} network ${networkToDelete.id} -> ${keepNetwork.id}`);
      
      // Find payments using the network to be deleted
      const paymentsToUpdate = await Payment.findAll({
        where: { networkId: networkToDelete.id },
        attributes: ['id', 'networkId']
      });

      if (paymentsToUpdate.length > 0) {
        console.log(`     Found ${paymentsToUpdate.length} payments to update`);
        
        // Update all payments to use the network we're keeping
        await Payment.update(
          { networkId: keepNetwork.id },
          { where: { networkId: networkToDelete.id } }
        );
        
        console.log(`     ✅ Updated ${paymentsToUpdate.length} payments`);
      } else {
        console.log(`     No payments found using this network`);
      }
    }

    // 4. Update tokens that reference networks to be deleted
    console.log('\n4. Updating token references:');
    for (const networkToDelete of networksToDelete) {
      const keepNetwork = networksToKeep[networkToDelete.shortName];
      
      console.log(`\n   Updating tokens from ${networkToDelete.shortName} network ${networkToDelete.id} -> ${keepNetwork.id}`);
      
      // Find tokens using the network to be deleted
      const tokensToUpdate = await Token.findAll({
        where: { networkId: networkToDelete.id },
        attributes: ['id', 'symbol', 'networkId']
      });

      if (tokensToUpdate.length > 0) {
        console.log(`     Found ${tokensToUpdate.length} tokens to update`);
        
        // Update all tokens to use the network we're keeping
        await Token.update(
          { networkId: keepNetwork.id },
          { where: { networkId: networkToDelete.id } }
        );
        
        console.log(`     ✅ Updated ${tokensToUpdate.length} tokens`);
      } else {
        console.log(`     No tokens found using this network`);
      }
    }

    // 5. Delete the duplicate networks
    console.log('\n5. Deleting duplicate networks:');
    for (const networkToDelete of networksToDelete) {
      console.log(`   Deleting: ${networkToDelete.id} - ${networkToDelete.name}`);
      await Network.destroy({
        where: { id: networkToDelete.id }
      });
      console.log(`   ✅ Deleted`);
    }

    // 6. Verify the cleanup
    console.log('\n6. Verification - Networks after cleanup:');
    const finalNetworks = await Network.findAll({
      attributes: ['id', 'name', 'shortName', 'type'],
      order: [['shortName', 'ASC']]
    });

    finalNetworks.forEach(network => {
      console.log(`   ${network.shortName}: ${network.name} (${network.id})`);
    });

    // 7. Test network lookups
    console.log('\n7. Testing network lookups:');
    const testNetworks = ['ethereum', 'solana', 'bsc', 'tron', 'algorand'];
    
    for (const networkName of testNetworks) {
      const foundNetwork = await Network.findOne({
        where: { 
          shortName: networkName,
          status: 'active'
        }
      });
      
      if (foundNetwork) {
        console.log(`   ✅ ${networkName} -> ${foundNetwork.name} (${foundNetwork.id})`);
      } else {
        console.log(`   ❌ ${networkName} -> Not found`);
      }
    }

    // 8. Check a few recent payments
    console.log('\n8. Checking recent payments:');
    const recentPayments = await Payment.findAll({
      limit: 5,
      include: [
        {
          model: Network,
          attributes: ['id', 'name', 'shortName'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    if (recentPayments.length > 0) {
      recentPayments.forEach(payment => {
        console.log(`   Payment ${payment.id.substring(0, 8)}: ${payment.currency} on ${payment.Network?.name || 'Unknown'}`);
      });
    } else {
      console.log('   No payments found');
    }

    console.log('\n✅ Duplicate network cleanup complete!');
    console.log('\n🎯 Next steps:');
    console.log('   1. Test creating a Solana payment');
    console.log('   2. Check that it shows "Solana Mainnet" in transactions');
    console.log('   3. Your network lookup should now be consistent');

  } catch (error) {
    console.error('❌ Error fixing duplicate networks:', error);
  } finally {
    process.exit(0);
  }
};

// Run the fix
fixDuplicateNetworks();
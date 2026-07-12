// scripts/addBaseNetwork.js
const db = require("../models");
const { Network, Token } = db;

async function addBaseNetwork() {
  try {
    console.log('🚀 Starting to add Base network...');

    // Base Network Configuration
    const baseNetworkData = {
      name: 'Base',
      shortName: 'base',
      chainId: '8453',
      rpcUrl: 'https://mainnet.base.org',
      explorerUrl: 'https://basescan.org',
      type: 'ethereum',
      isTestnet: false,
      status: 'active',
      paymentSplitterAddress: '0x0000000000000000000000000000000000000000' // Update this when contract is deployed
    };

    // Create or find Base network
    const [baseNetwork, created] = await Network.findOrCreate({
      where: { shortName: 'base' },
      defaults: baseNetworkData
    });

    if (created) {
      console.log('✅ Created Base network:', baseNetwork.id);
    } else {
      console.log('ℹ️  Base network already exists:', baseNetwork.id);
    }

    // Base Network Tokens (Stablecoins)
    const baseTokens = [
      {
        name: 'USD Coin',
        symbol: 'USDC',
        contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
        isStablecoin: true,
        status: 'active',
        minAmount: 0.01
      },
      {
        name: 'Tether USD',
        symbol: 'USDT',
        contractAddress: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
        decimals: 6,
        isStablecoin: true,
        status: 'active',
        minAmount: 0.01
      },
      {
        name: 'Dai Stablecoin',
        symbol: 'DAI',
        contractAddress: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
        decimals: 18,
        isStablecoin: true,
        status: 'active',
        minAmount: 0.01
      }
    ];

    // Add tokens for Base
    console.log('\n📝 Adding tokens for Base network...');
    for (const tokenData of baseTokens) {
      const [token, tokenCreated] = await Token.findOrCreate({
        where: {
          networkId: baseNetwork.id,
          symbol: tokenData.symbol
        },
        defaults: {
          ...tokenData,
          networkId: baseNetwork.id
        }
      });

      if (tokenCreated) {
        console.log(`  ✅ Created token: ${tokenData.symbol} (${tokenData.name})`);
      } else {
        console.log(`  ℹ️  Token already exists: ${tokenData.symbol}`);
      }
    }

    console.log('\n✅ Base network setup completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`  Network: ${baseNetwork.name}`);
    console.log(`  Chain ID: ${baseNetwork.chainId}`);
    console.log(`  Short Name: ${baseNetwork.shortName}`);
    console.log(`  Explorer: ${baseNetwork.explorerUrl}`);
    console.log(`  Tokens: ${baseTokens.length} stablecoins added`);

  } catch (error) {
    console.error('❌ Error adding Base network:', error);
    throw error;
  }
}

// Run the script
addBaseNetwork()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

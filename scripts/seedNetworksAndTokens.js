// // scripts/seedNetworksAndTokens.js
// const db = require("../models");
// const { Network, Token } = db;

// async function seedNetworksAndTokens() {
//   try {
//     console.log('Starting to seed networks and tokens...');
    
//     // Define all networks
//     const networks = [
//       // Ethereum
//       {
//         name: 'Ethereum',
//         shortName: 'ethereum',
//         chainId: '0x1', // Mainnet
//         rpcUrl: 'https://mainnet.infura.io/v3/21f0c9ba4be0420083cfbfa4c520e648',
//         explorerUrl: 'https://etherscan.io',
//         type: 'ethereum',
//         isTestnet: false,
//         status: 'active'
//       },
//       // BSC
//       {
//         name: 'Binance Smart Chain',
//         shortName: 'bsc',
//         chainId: '0x38', // Mainnet
//         rpcUrl: 'https://bsc-dataseed.binance.org/',
//         explorerUrl: 'https://bscscan.com',
//         type: 'bsc',
//         isTestnet: false,
//         status: 'active'
//       },
//       // TRON
//       {
//         name: 'TRON',
//         shortName: 'tron',
//         chainId: '0x2b6653dc', // TRC-20 doesn't use chainId in the same way, using a placeholder
//         rpcUrl: 'https://api.trongrid.io',
//         explorerUrl: 'https://tronscan.org',
//         type: 'tron',
//         isTestnet: false,
//         status: 'active'
//       },
//       // Algorand
//       {
//         name: 'Algorand',
//         shortName: 'algorand',
//         chainId: '0x12345678', // Algorand doesn't use chainId in the same way, using a placeholder
//         rpcUrl: 'https://mainnet-api.algonode.cloud',
//         explorerUrl: 'https://algoexplorer.io',
//         type: 'algorand',
//         isTestnet: false,
//         status: 'active'
//       },
//       // Solana
//       {
//         name: 'Solana',
//         shortName: 'solana',
//         chainId: '0x65', // Solana doesn't use chainId in the same way, using a placeholder
//         rpcUrl: 'https://api.mainnet-beta.solana.com',
//         explorerUrl: 'https://explorer.solana.com',
//         type: 'solana',
//         isTestnet: false,
//         status: 'active'
//       }
//     ];

//     // Create all networks
//     const createdNetworks = {};
//     for (const networkData of networks) {
//       const [network, created] = await Network.findOrCreate({
//         where: { shortName: networkData.shortName },
//         defaults: networkData
//       });
      
//       console.log(`${created ? 'Created' : 'Found existing'} ${networkData.name} network`);
//       createdNetworks[networkData.shortName] = network;
//     }

//     // Define tokens for each network
//     const tokensByNetwork = {
//       'ethereum': [
//         {
//           name: 'Tether USD',
//           symbol: 'USDT',
//           contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
//           decimals: 6,
//           isStablecoin: true
//         },
//         {
//           name: 'USD Coin',
//           symbol: 'USDC',
//           contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
//           decimals: 6,
//           isStablecoin: true
//         },
//         {
//           name: 'Frax',
//           symbol: 'FRAX',
//           contractAddress: '0x853d955aCEf822Db058eb8505911ED77F175b99e',
//           decimals: 18,
//           isStablecoin: true
//         },
//         {
//           name: 'PayPal USD',
//           symbol: 'PYUSD',
//           contractAddress: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8',
//           decimals: 6,
//           isStablecoin: true
//         },
//         {
//           name: 'Pax Dollar',
//           symbol: 'USDP',
//           contractAddress: '0x8E870D67F660D95d5be530380D0eC0bd388289E1',
//           decimals: 18,
//           isStablecoin: true
//         },
//         {
//           name: 'Raft Locked USDC',
//           symbol: 'RLUSD',
//           contractAddress: '0x8c97C22485eB7B4c3Eb5B272e668984934E86d67',
//           decimals: 18,
//           isStablecoin: true
//         }
//       ],
//       'bsc': [
//         {
//           name: 'Tether USD (BSC)',
//           symbol: 'USDT',
//           contractAddress: '0x55d398326f99059fF775485246999027B3197955',
//           decimals: 18,
//           isStablecoin: true
//         },
//         {
//           name: 'USD Coin (BSC)',
//           symbol: 'USDC',
//           contractAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
//           decimals: 18,
//           isStablecoin: true
//         },
//         {
//           name: 'Frax (BSC)',
//           symbol: 'FRAX',
//           contractAddress: '0x90C97F71E18723b0Cf0dfa30ee176Ab653E89F40',
//           decimals: 18,
//           isStablecoin: true
//         }
//       ],
//       'tron': [
//         {
//           name: 'Tether USD (TRON)',
//           symbol: 'USDT',
//           contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
//           decimals: 6,
//           isStablecoin: true
//         },
//         {
//           name: 'USD Coin (TRON)',
//           symbol: 'USDC',
//           contractAddress: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
//           decimals: 6,
//           isStablecoin: true
//         }
//       ],
//       'algorand': [
//         {
//           name: 'USDT (Algorand)',
//           symbol: 'USDT',
//           contractAddress: '312769', // Algorand ASA ID
//           decimals: 6,
//           isStablecoin: true
//         },
//         {
//           name: 'USDC (Algorand)',
//           symbol: 'USDC',
//           contractAddress: '31566704', // Algorand ASA ID
//           decimals: 6,
//           isStablecoin: true
//         }
//       ],
//       'solana': [
//         {
//           name: 'USDT (Solana)',
//           symbol: 'USDT',
//           contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
//           decimals: 6,
//           isStablecoin: true
//         },
//         {
//           name: 'USDC (Solana)',
//           symbol: 'USDC',
//           contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
//           decimals: 6,
//           isStablecoin: true
//         }
//       ]
//     };

//     // Create tokens for each network
//     for (const [networkShortName, tokens] of Object.entries(tokensByNetwork)) {
//       const networkId = createdNetworks[networkShortName].id;
      
//       for (const tokenData of tokens) {
//         const [token, created] = await Token.findOrCreate({
//           where: {
//             symbol: tokenData.symbol,
//             networkId: networkId
//           },
//           defaults: {
//             ...tokenData,
//             networkId,
//             status: 'active'
//           }
//         });
        
//         console.log(`${created ? 'Created' : 'Found existing'} ${tokenData.name} token on ${networkShortName}`);
//       }
//     }

//     console.log('Networks and tokens seeded successfully');
//     return { success: true };
//   } catch (error) {
//     console.error('Error seeding networks and tokens:', error);
//     return { success: false, error };
//   }
// }

// // Run the seeder directly if this file is executed
// if (require.main === module) {
//   // Connect to database
//   db.sequelize.authenticate()
//     .then(() => {
//       console.log('Database connection established');
//       return seedNetworksAndTokens();
//     })
//     .then(result => {
//       console.log('Seeding completed:', result.success ? 'Success' : 'Failed');
//       process.exit(0);
//     })
//     .catch(err => {
//       console.error('Seeding error:', err);
//       process.exit(1);
//     });
// } else {
//   // Export for use in other files
//   module.exports = seedNetworksAndTokens;
// }








// scripts/seedNetworksAndTokens.js - Updated with new networks
const db = require("../models");
const { Network, Token } = db;

async function seedNetworksAndTokens() {
  try {
    console.log('Starting to seed networks and tokens...');
    
    // Define all networks including new ones
    const networks = [
      // ===== EXISTING NETWORKS =====
      // Ethereum
      {
        name: 'Ethereum',
        shortName: 'ethereum',
        chainId: '0x1', // 1
        rpcUrl: 'https://mainnet.infura.io/v3/21f0c9ba4be0420083cfbfa4c520e648',
        explorerUrl: 'https://etherscan.io',
        type: 'ethereum',
        isTestnet: false,
        status: 'active'
      },
      // BSC
      {
        name: 'Binance Smart Chain',
        shortName: 'bsc',
        chainId: '0x38', // 56
        rpcUrl: 'https://bsc-dataseed.binance.org/',
        explorerUrl: 'https://bscscan.com',
        type: 'ethereum', // BSC is EVM compatible
        isTestnet: false,
        status: 'active'
      },
      // TRON
      {
        name: 'TRON',
        shortName: 'tron',
        chainId: '0x2b6653dc', // Placeholder for TRON
        rpcUrl: 'https://api.trongrid.io',
        explorerUrl: 'https://tronscan.org',
        type: 'tron',
        isTestnet: false,
        status: 'active'
      },
      // Algorand
      {
        name: 'Algorand',
        shortName: 'algorand',
        chainId: '0x12345678', // Placeholder for Algorand
        rpcUrl: 'https://mainnet-api.algonode.cloud',
        explorerUrl: 'https://algoexplorer.io',
        type: 'algorand',
        isTestnet: false,
        status: 'active'
      },
      // Solana Mainnet
      {
        name: 'Solana',
        shortName: 'solana',
        chainId: '0x65', // Placeholder for Solana
        rpcUrl: 'https://api.mainnet-beta.solana.com',
        explorerUrl: 'https://explorer.solana.com',
        type: 'solana',
        isTestnet: false,
        status: 'active'
      },
      // Solana Devnet (for testing PaymentSplitter)
      {
        name: 'Solana Devnet',
        shortName: 'solana-devnet',
        chainId: '0x66', // Placeholder for Solana Devnet
        rpcUrl: 'https://api.devnet.solana.com',
        explorerUrl: 'https://explorer.solana.com/?cluster=devnet',
        type: 'solana',
        isTestnet: true,
        status: 'active',
        paymentSplitterAddress: 'Crz57kC6npUiFHx7xg1sE2oMDXLFHeqKhDgXJXcuDT3B'
      },
      
      // ===== NEW NETWORKS =====
      // Optimism
      {
        name: 'Optimism',
        shortName: 'optimism',
        chainId: '0xa', // 10
        rpcUrl: 'https://mainnet.optimism.io',
        explorerUrl: 'https://optimistic.etherscan.io',
        type: 'ethereum', // Optimism is an Ethereum L2
        isTestnet: false,
        status: 'active'
      },
      // Arbitrum One
      {
        name: 'Arbitrum One',
        shortName: 'arbitrum',
        chainId: '0xa4b1', // 42161
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
        explorerUrl: 'https://arbiscan.io',
        type: 'ethereum', // Arbitrum is an Ethereum L2
        isTestnet: false,
        status: 'active'
      },
      // Polygon
      {
        name: 'Polygon',
        shortName: 'polygon',
        chainId: '0x89', // 137
        rpcUrl: 'https://polygon-rpc.com',
        explorerUrl: 'https://polygonscan.com',
        type: 'ethereum', // Polygon is EVM compatible
        isTestnet: false,
        status: 'active'
      },
      // Avalanche C-Chain
      {
        name: 'Avalanche C-Chain',
        shortName: 'avalanche',
        chainId: '0xa86a', // 43114
        rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
        explorerUrl: 'https://snowtrace.io',
        type: 'ethereum', // Avalanche C-Chain is EVM compatible
        isTestnet: false,
        status: 'active'
      },
      // Celo
      {
        name: 'Celo',
        shortName: 'celo',
        chainId: '0xa4ec', // 42220
        rpcUrl: 'https://forno.celo.org',
        explorerUrl: 'https://celoscan.io',
        type: 'ethereum', // Celo is EVM compatible
        isTestnet: false,
        status: 'active'
      },
      // Base
      {
        name: 'Base',
        shortName: 'base',
        chainId: '0x2105', // 8453
        rpcUrl: 'https://mainnet.base.org',
        explorerUrl: 'https://basescan.org',
        type: 'ethereum', // Base is an Ethereum L2
        isTestnet: false,
        status: 'active',
        paymentSplitterAddress: '0x6D827e60d0dC279cAa09f026d1641ECDb5704753'
      }
    ];

    // Create all networks
    const createdNetworks = {};
    for (const networkData of networks) {
      const [network, created] = await Network.findOrCreate({
        where: { shortName: networkData.shortName },
        defaults: networkData
      });
      
      console.log(`${created ? 'Created' : 'Found existing'} ${networkData.name} network`);
      createdNetworks[networkData.shortName] = network;
    }

    // Define tokens for each network including new ones
    const tokensByNetwork = {
      // ===== EXISTING NETWORK TOKENS =====
      'ethereum': [
        {
          name: 'Tether USD',
          symbol: 'USDT',
          contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'USD Coin',
          symbol: 'USDC',
          contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'Frax',
          symbol: 'FRAX',
          contractAddress: '0x853d955aCEf822Db058eb8505911ED77F175b99e',
          decimals: 18,
          isStablecoin: true
        },
        {
          name: 'PayPal USD',
          symbol: 'PYUSD',
          contractAddress: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'Pax Dollar',
          symbol: 'USDP',
          contractAddress: '0x8E870D67F660D95d5be530380D0eC0bd388289E1',
          decimals: 18,
          isStablecoin: true
        },
        {
          name: 'Dai Stablecoin',
          symbol: 'DAI',
          contractAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          decimals: 18,
          isStablecoin: true
        }
      ],
      'bsc': [
        {
          name: 'Tether USD (BSC)',
          symbol: 'USDT',
          contractAddress: '0x55d398326f99059fF775485246999027B3197955',
          decimals: 18,
          isStablecoin: true
        },
        {
          name: 'USD Coin (BSC)',
          symbol: 'USDC',
          contractAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
          decimals: 18,
          isStablecoin: true
        },
        {
          name: 'Binance USD',
          symbol: 'BUSD',
          contractAddress: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
          decimals: 18,
          isStablecoin: true
        },
        {
          name: 'Frax (BSC)',
          symbol: 'FRAX',
          contractAddress: '0x90C97F71E18723b0Cf0dfa30ee176Ab653E89F40',
          decimals: 18,
          isStablecoin: true
        }
      ],
      'tron': [
        {
          name: 'Tether USD (TRON)',
          symbol: 'USDT',
          contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'USD Coin (TRON)',
          symbol: 'USDC',
          contractAddress: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'JUST Stablecoin',
          symbol: 'USDJ',
          contractAddress: 'TMwFHYXLJaRUPeW6421aqXL4ZEzPRFGkGT',
          decimals: 18,
          isStablecoin: true
        }
      ],
      'algorand': [
        {
          name: 'USDT (Algorand)',
          symbol: 'USDT',
          contractAddress: '312769', // Algorand ASA ID
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'USDC (Algorand)',
          symbol: 'USDC',
          contractAddress: '31566704', // Algorand ASA ID
          decimals: 6,
          isStablecoin: true
        }
      ],
      'solana': [
        {
          name: 'USDT (Solana)',
          symbol: 'USDT',
          contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'USDC (Solana)',
          symbol: 'USDC',
          contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          decimals: 6,
          isStablecoin: true
        }
      ],
      'solana-devnet': [
        {
          name: 'USDC (Solana Devnet)',
          symbol: 'USDC',
          contractAddress: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
          decimals: 6,
          isStablecoin: true
        }
      ],

      // ===== NEW NETWORK TOKENS =====
      'optimism': [
        {
          name: 'USD Coin (Optimism)',
          symbol: 'USDC',
          contractAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'Tether USD (Optimism)',
          symbol: 'USDT',
          contractAddress: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'Dai Stablecoin (Optimism)',
          symbol: 'DAI',
          contractAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
          decimals: 18,
          isStablecoin: true
        },
        {
          name: 'Frax (Optimism)',
          symbol: 'FRAX',
          contractAddress: '0x2E3D870790dC77A83DD1d18184Acc7439A53f475',
          decimals: 18,
          isStablecoin: true
        }
      ],
      'arbitrum': [
        {
          name: 'USD Coin (Arbitrum)',
          symbol: 'USDC',
          contractAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'Tether USD (Arbitrum)',
          symbol: 'USDT',
          contractAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'Dai Stablecoin (Arbitrum)',
          symbol: 'DAI',
          contractAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
          decimals: 18,
          isStablecoin: true
        },
        {
          name: 'Frax (Arbitrum)',
          symbol: 'FRAX',
          contractAddress: '0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F',
          decimals: 18,
          isStablecoin: true
        }
      ],
      'polygon': [
        {
          name: 'USD Coin (Polygon)',
          symbol: 'USDC',
          contractAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'Tether USD (Polygon)',
          symbol: 'USDT',
          contractAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'Dai Stablecoin (Polygon)',
          symbol: 'DAI',
          contractAddress: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
          decimals: 18,
          isStablecoin: true
        },
        {
          name: 'Frax (Polygon)',
          symbol: 'FRAX',
          contractAddress: '0x45c32fA6DF82ead1e2EF74d17b76547EDdFaFF89',
          decimals: 18,
          isStablecoin: true
        }
      ],
      'avalanche': [
        {
          name: 'USD Coin (Avalanche)',
          symbol: 'USDC',
          contractAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'Tether USD (Avalanche)',
          symbol: 'USDT',
          contractAddress: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'Dai Stablecoin (Avalanche)',
          symbol: 'DAI',
          contractAddress: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
          decimals: 18,
          isStablecoin: true
        },
        {
          name: 'Frax (Avalanche)',
          symbol: 'FRAX',
          contractAddress: '0xD24C2Ad096400B6FBcd2ad8B24E7acBc21A1da64',
          decimals: 18,
          isStablecoin: true
        }
      ],
      'celo': [
        {
          name: 'USD Coin (Celo)',
          symbol: 'USDC',
          contractAddress: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'Tether USD (Celo)',
          symbol: 'USDT',
          contractAddress: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'Celo Dollar',
          symbol: 'cUSD',
          contractAddress: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
          decimals: 18,
          isStablecoin: true
        },
        {
          name: 'Celo Euro',
          symbol: 'cEUR',
          contractAddress: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
          decimals: 18,
          isStablecoin: true
        }
      ],
      'base': [
        {
          name: 'USD Coin (Base)',
          symbol: 'USDC',
          contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          decimals: 6,
          isStablecoin: true
        },
        {
          name: 'Tether USD (Base)',
          symbol: 'USDT',
          contractAddress: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
          decimals: 6,
          isStablecoin: true
        }
      ]
    };

    // Create tokens for each network
    for (const [networkShortName, tokens] of Object.entries(tokensByNetwork)) {
      const networkId = createdNetworks[networkShortName].id;
      
      for (const tokenData of tokens) {
        const [token, created] = await Token.findOrCreate({
          where: {
            symbol: tokenData.symbol,
            networkId: networkId
          },
          defaults: {
            ...tokenData,
            networkId,
            status: 'active'
          }
        });
        
        console.log(`${created ? 'Created' : 'Found existing'} ${tokenData.name} token on ${networkShortName}`);
      }
    }

    console.log('✅ Networks and tokens seeded successfully');
    console.log('📊 Summary:');
    console.log(`- Total networks: ${Object.keys(createdNetworks).length}`);
    console.log(`- Networks: ${Object.keys(createdNetworks).join(', ')}`);
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error seeding networks and tokens:', error);
    return { success: false, error };
  }
}

// Run the seeder directly if this file is executed
if (require.main === module) {
  // Connect to database
  db.sequelize.authenticate()
    .then(() => {
      console.log('🔗 Database connection established');
      return seedNetworksAndTokens();
    })
    .then(result => {
      console.log('🎉 Seeding completed:', result.success ? 'Success' : 'Failed');
      process.exit(0);
    })
    .catch(err => {
      console.error('💥 Seeding error:', err);
      process.exit(1);
    });
} else {
  // Export for use in other files
  module.exports = seedNetworksAndTokens;
}
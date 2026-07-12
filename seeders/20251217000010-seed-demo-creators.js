'use strict';
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get categories
    const categories = await queryInterface.sequelize.query(
      'SELECT id, slug FROM "Categories" LIMIT 10;',
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Get states (Lagos, FCT, Rivers, Oyo, Kano)
    const states = await queryInterface.sequelize.query(
      `SELECT id, name, "regionId" FROM "States" WHERE code IN ('LA', 'FC', 'RI', 'OY', 'KN');`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Get cities for Lagos
    const cities = await queryInterface.sequelize.query(
      `SELECT id, name, "stateId" FROM "Cities" LIMIT 10;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const categoryMap = {};
    categories.forEach(c => { categoryMap[c.slug] = c.id; });

    const stateMap = {};
    states.forEach(s => { stateMap[s.name] = { id: s.id, regionId: s.regionId }; });

    const hashedPassword = await bcrypt.hash('Password123!', 12);

    // Demo creators - 3 per category (10 categories = 30 creators)
    const demoCreators = [
      // Fashion (3)
      { firstName: 'Amaka', lastName: 'Okonkwo', displayName: 'AmakasStyle', bio: 'Fashion enthusiast & style curator. Helping Nigerian women look their best with affordable fashion tips.', niche: 'fashion', tier: 'premium', state: 'Lagos', rating: 4.8, reviews: 45, earnings: 1500000, collabs: 28, followers: 125000 },
      { firstName: 'David', lastName: 'Adeleke', displayName: 'DavidFits', bio: 'Men\'s fashion blogger. Street style meets African elegance.', niche: 'fashion', tier: 'verified', state: 'Lagos', rating: 4.5, reviews: 23, earnings: 650000, collabs: 15, followers: 78000 },
      { firstName: 'Fatima', lastName: 'Ibrahim', displayName: 'FatimaGlam', bio: 'Modest fashion advocate. Blending tradition with modern trends.', niche: 'fashion', tier: 'rising', state: 'Kano', rating: 4.2, reviews: 8, earnings: 120000, collabs: 5, followers: 32000 },

      // Beauty (3)
      { firstName: 'Chioma', lastName: 'Eze', displayName: 'ChiomaBeauty', bio: 'Makeup artist & beauty influencer. Tutorials for melanin queens.', niche: 'beauty', tier: 'elite', state: 'Lagos', rating: 4.9, reviews: 89, earnings: 5200000, collabs: 67, followers: 450000 },
      { firstName: 'Ngozi', lastName: 'Okoro', displayName: 'NgoziGlow', bio: 'Skincare specialist. Nigerian beauty secrets & product reviews.', niche: 'beauty', tier: 'premium', state: 'Federal Capital Territory', rating: 4.7, reviews: 34, earnings: 1800000, collabs: 31, followers: 165000 },
      { firstName: 'Aisha', lastName: 'Mohammed', displayName: 'AishaBeautyTips', bio: 'Natural hair & beauty content creator based in Abuja.', niche: 'beauty', tier: 'verified', state: 'Federal Capital Territory', rating: 4.4, reviews: 19, earnings: 420000, collabs: 12, followers: 55000 },

      // Technology (3)
      { firstName: 'Emeka', lastName: 'Nwankwo', displayName: 'TechWithEmeka', bio: 'Tech reviewer & gadget enthusiast. Honest reviews for Nigerian consumers.', niche: 'technology', tier: 'premium', state: 'Lagos', rating: 4.6, reviews: 52, earnings: 2100000, collabs: 38, followers: 210000 },
      { firstName: 'Oluwaseun', lastName: 'Ajayi', displayName: 'SeunTechReviews', bio: 'Software engineer turned tech influencer. Apps, gadgets & coding tutorials.', niche: 'technology', tier: 'verified', state: 'Lagos', rating: 4.5, reviews: 28, earnings: 780000, collabs: 18, followers: 95000 },
      { firstName: 'Bola', lastName: 'Adeyemi', displayName: 'BolaDigital', bio: 'Digital lifestyle content. Making tech accessible for everyone.', niche: 'technology', tier: 'rising', state: 'Oyo', rating: 4.3, reviews: 11, earnings: 180000, collabs: 6, followers: 28000 },

      // Food & Cooking (3)
      { firstName: 'Adaeze', lastName: 'Obi', displayName: 'AdaezeKitchen', bio: 'Nigerian food blogger. Traditional recipes with a modern twist.', niche: 'food-cooking', tier: 'elite', state: 'Lagos', rating: 4.9, reviews: 78, earnings: 4800000, collabs: 55, followers: 380000 },
      { firstName: 'Yusuf', lastName: 'Bello', displayName: 'ChefYusuf', bio: 'Professional chef & food content creator. Northern Nigerian cuisine specialist.', niche: 'food-cooking', tier: 'premium', state: 'Kano', rating: 4.7, reviews: 41, earnings: 1650000, collabs: 29, followers: 145000 },
      { firstName: 'Blessing', lastName: 'Udoh', displayName: 'BlessingsKitchen', bio: 'Home cook sharing easy recipes for busy Nigerian moms.', niche: 'food-cooking', tier: 'verified', state: 'Rivers', rating: 4.4, reviews: 22, earnings: 520000, collabs: 14, followers: 62000 },

      // Fitness & Health (3)
      { firstName: 'Tunde', lastName: 'Bakare', displayName: 'FitWithTunde', bio: 'Certified fitness trainer. Transforming bodies across Nigeria.', niche: 'fitness-health', tier: 'premium', state: 'Lagos', rating: 4.8, reviews: 63, earnings: 2400000, collabs: 42, followers: 195000 },
      { firstName: 'Kemi', lastName: 'Fasanya', displayName: 'KemiFitness', bio: 'Women\'s fitness coach. Home workouts & nutrition tips.', niche: 'fitness-health', tier: 'verified', state: 'Lagos', rating: 4.6, reviews: 31, earnings: 890000, collabs: 21, followers: 88000 },
      { firstName: 'Ahmed', lastName: 'Suleiman', displayName: 'AhmedFitLife', bio: 'Wellness advocate & marathon runner. Health is wealth!', niche: 'fitness-health', tier: 'rising', state: 'Federal Capital Territory', rating: 4.2, reviews: 9, earnings: 145000, collabs: 4, followers: 24000 },

      // Travel (3)
      { firstName: 'Ifeoma', lastName: 'Chukwu', displayName: 'IfeomaTravels', bio: 'Travel blogger exploring Nigeria & Africa. Budget travel tips.', niche: 'travel', tier: 'premium', state: 'Lagos', rating: 4.7, reviews: 47, earnings: 1950000, collabs: 35, followers: 175000 },
      { firstName: 'Michael', lastName: 'Okon', displayName: 'MikeExploresNG', bio: 'Adventure photographer & travel vlogger. Discovering hidden gems.', niche: 'travel', tier: 'verified', state: 'Rivers', rating: 4.5, reviews: 26, earnings: 720000, collabs: 17, followers: 82000 },
      { firstName: 'Halima', lastName: 'Abdullahi', displayName: 'HalimaTravels', bio: 'Solo female traveler. Inspiring women to explore the world.', niche: 'travel', tier: 'rising', state: 'Kano', rating: 4.3, reviews: 12, earnings: 210000, collabs: 7, followers: 35000 },

      // Entertainment (3)
      { firstName: 'Chinedu', lastName: 'Ikenna', displayName: 'ChineduComedy', bio: 'Comedian & content creator. Bringing laughter to your timeline.', niche: 'entertainment', tier: 'elite', state: 'Lagos', rating: 4.9, reviews: 95, earnings: 6500000, collabs: 72, followers: 520000 },
      { firstName: 'Shade', lastName: 'Williams', displayName: 'ShadeSkits', bio: 'Skitmaker & actress. Original Nigerian comedy content.', niche: 'entertainment', tier: 'premium', state: 'Lagos', rating: 4.8, reviews: 56, earnings: 2800000, collabs: 44, followers: 280000 },
      { firstName: 'Obinna', lastName: 'Agu', displayName: 'ObinnaVibes', bio: 'MC, hypeman & event content creator. Energy for days!', niche: 'entertainment', tier: 'verified', state: 'Federal Capital Territory', rating: 4.5, reviews: 24, earnings: 680000, collabs: 16, followers: 72000 },

      // Education (3)
      { firstName: 'Funke', lastName: 'Adeola', displayName: 'FunkeTeaches', bio: 'Educator & edtech advocate. Making learning fun for Nigerian students.', niche: 'education', tier: 'premium', state: 'Lagos', rating: 4.8, reviews: 38, earnings: 1350000, collabs: 25, followers: 135000 },
      { firstName: 'Ibrahim', lastName: 'Musa', displayName: 'IbrahimEducates', bio: 'STEM educator & career counselor. Helping youth find their path.', niche: 'education', tier: 'verified', state: 'Kano', rating: 4.6, reviews: 21, earnings: 540000, collabs: 13, followers: 58000 },
      { firstName: 'Precious', lastName: 'Nnamdi', displayName: 'PreciousLearns', bio: 'Study tips & productivity hacks for Nigerian students.', niche: 'education', tier: 'rising', state: 'Rivers', rating: 4.3, reviews: 10, earnings: 165000, collabs: 5, followers: 26000 },

      // Gaming (3)
      { firstName: 'Femi', lastName: 'Oladipo', displayName: 'FemiGames', bio: 'Pro gamer & streamer. FIFA, COD & all things gaming.', niche: 'gaming', tier: 'premium', state: 'Lagos', rating: 4.7, reviews: 44, earnings: 1750000, collabs: 32, followers: 185000 },
      { firstName: 'Uche', lastName: 'Okafor', displayName: 'UcheGaming', bio: 'Mobile gaming specialist. Esports commentary & game reviews.', niche: 'gaming', tier: 'verified', state: 'Lagos', rating: 4.5, reviews: 27, earnings: 620000, collabs: 15, followers: 75000 },
      { firstName: 'Sandra', lastName: 'Etim', displayName: 'SandraPlays', bio: 'Female gamer breaking stereotypes. RPGs & adventure games.', niche: 'gaming', tier: 'rising', state: 'Rivers', rating: 4.2, reviews: 8, earnings: 130000, collabs: 4, followers: 22000 },

      // Lifestyle (3)
      { firstName: 'Tola', lastName: 'Oni', displayName: 'TolasLife', bio: 'Lifestyle blogger & vlogger. Day in the life of a Lagos babe.', niche: 'lifestyle', tier: 'premium', state: 'Lagos', rating: 4.7, reviews: 49, earnings: 1880000, collabs: 36, followers: 195000 },
      { firstName: 'Jide', lastName: 'Akintola', displayName: 'JideLifestyle', bio: 'Men\'s lifestyle & grooming. Living your best life in Nigeria.', niche: 'lifestyle', tier: 'verified', state: 'Oyo', rating: 4.5, reviews: 25, earnings: 590000, collabs: 14, followers: 68000 },
      { firstName: 'Zainab', lastName: 'Aliyu', displayName: 'ZainabDaily', bio: 'Minimalist lifestyle advocate. Intentional living for Nigerians.', niche: 'lifestyle', tier: 'rising', state: 'Federal Capital Territory', rating: 4.3, reviews: 11, earnings: 175000, collabs: 6, followers: 29000 },
    ];

    const users = [];
    const creators = [];

    for (let i = 0; i < demoCreators.length; i++) {
      const demo = demoCreators[i];
      const userId = uuidv4();
      const creatorId = uuidv4();
      const email = `${demo.displayName.toLowerCase()}@demo.creatorsworld.ng`;

      const stateInfo = stateMap[demo.state] || stateMap['Lagos'];
      const cityInfo = cities.length > 0 ? cities[i % cities.length] : null;

      const commissionRates = { rising: 0.20, verified: 0.18, premium: 0.15, elite: 0.10 };

      users.push({
        id: userId,
        email: email,
        password: hashedPassword,
        userType: 'creator',
        verified: true,
        status: 'active',
        onboardingCompleted: true,
        onboardingStep: 5,
        lastLoginAt: new Date(),
        createdAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000), // Random date within last 6 months
        updatedAt: new Date()
      });

      creators.push({
        id: creatorId,
        userId: userId,
        firstName: demo.firstName,
        lastName: demo.lastName,
        displayName: demo.displayName,
        bio: demo.bio,
        profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${demo.displayName}`,
        coverImage: `https://picsum.photos/seed/${demo.displayName}/1200/400`,
        phone: `+234${Math.floor(7000000000 + Math.random() * 999999999)}`,
        regionId: stateInfo.regionId,
        stateId: stateInfo.id,
        cityId: cityInfo ? cityInfo.id : null,
        primaryNicheId: categoryMap[demo.niche],
        secondaryNiches: null,
        yearsOfExperience: Math.floor(1 + Math.random() * 7),
        languages: ['English', demo.state === 'Kano' ? 'Hausa' : demo.state === 'Lagos' ? 'Yoruba' : 'Igbo'],
        tier: demo.tier,
        tierPoints: demo.tier === 'elite' ? 5000 : demo.tier === 'premium' ? 2000 : demo.tier === 'verified' ? 500 : 0,
        commissionRate: commissionRates[demo.tier],
        verificationStatus: demo.tier === 'rising' ? 'unverified' : 'verified',
        verifiedAt: demo.tier !== 'rising' ? new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000) : null,
        arconCompliant: demo.tier === 'elite' || demo.tier === 'premium',
        availabilityStatus: 'available',
        responseTime: demo.tier === 'elite' ? 'within_24h' : 'within_48h',
        leadTimeDays: demo.tier === 'elite' ? 2 : demo.tier === 'premium' ? 3 : 5,
        totalEarnings: demo.earnings,
        pendingEarnings: Math.floor(demo.earnings * 0.1),
        availableBalance: Math.floor(demo.earnings * 0.15),
        completedCollaborations: demo.collabs,
        averageRating: demo.rating,
        totalReviews: demo.reviews,
        profileViews: Math.floor(demo.followers * 0.3),
        acceptsNegotiation: true,
        minimumBudget: demo.tier === 'elite' ? 100000 : demo.tier === 'premium' ? 50000 : demo.tier === 'verified' ? 20000 : 10000,
        createdAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      });
    }

    await queryInterface.bulkInsert('Users', users, {});
    await queryInterface.bulkInsert('Creators', creators, {});

    // Add some rate cards for each creator
    const rateCards = [];
    const platforms = ['instagram', 'tiktok', 'youtube', 'twitter'];
    const contentTypes = {
      instagram: ['post', 'story', 'reel'],
      tiktok: ['video'],
      youtube: ['video', 'short'],
      twitter: ['tweet', 'thread']
    };

    for (const creator of creators) {
      const basePrices = {
        elite: 100000,
        premium: 50000,
        verified: 25000,
        rising: 10000
      };
      const basePrice = basePrices[creator.tier];

      // Add 2-4 rate cards per creator
      const numRates = 2 + Math.floor(Math.random() * 3);
      const selectedPlatforms = platforms.slice(0, numRates);

      for (const platform of selectedPlatforms) {
        const types = contentTypes[platform];
        for (const contentType of types) {
          const multiplier = platform === 'youtube' ? 2 : platform === 'instagram' ? 1.2 : 1;
          const price = Math.round(basePrice * multiplier * (0.8 + Math.random() * 0.4));

          rateCards.push({
            id: uuidv4(),
            creatorId: creator.id,
            platform: platform,
            contentType: contentType.charAt(0).toUpperCase() + contentType.slice(1),
            description: `Professional ${contentType} content on ${platform}`,
            priceType: 'fixed',
            basePrice: price,
            currency: 'NGN',
            deliveryDays: platform === 'youtube' ? 7 : 3,
            revisionsIncluded: creator.tier === 'elite' ? 3 : creator.tier === 'premium' ? 2 : 1,
            usageRightsDays: 30,
            isActive: true,
            displayOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    }

    await queryInterface.bulkInsert('RateCards', rateCards, {});

    // Add social accounts for each creator
    const socialAccounts = [];
    for (const creator of creators) {
      const demo = demoCreators.find(d => d.displayName === creator.displayName);
      const followerBase = demo ? demo.followers : 50000;

      // Instagram
      socialAccounts.push({
        id: uuidv4(),
        creatorId: creator.id,
        platform: 'instagram',
        username: creator.displayName.toLowerCase(),
        profileUrl: `https://instagram.com/${creator.displayName.toLowerCase()}`,
        followersCount: followerBase,
        followingCount: Math.floor(followerBase * 0.1),
        postsCount: Math.floor(100 + Math.random() * 500),
        engagementRate: 3.5 + Math.random() * 4,
        verified: creator.tier !== 'rising',
        isActive: true,
        lastSyncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // TikTok (for most)
      if (Math.random() > 0.3) {
        socialAccounts.push({
          id: uuidv4(),
          creatorId: creator.id,
          platform: 'tiktok',
          username: creator.displayName.toLowerCase(),
          profileUrl: `https://tiktok.com/@${creator.displayName.toLowerCase()}`,
          followersCount: Math.floor(followerBase * (0.5 + Math.random() * 0.8)),
          followingCount: Math.floor(followerBase * 0.05),
          postsCount: Math.floor(50 + Math.random() * 200),
          engagementRate: 5 + Math.random() * 6,
          verified: creator.tier === 'elite' || creator.tier === 'premium',
          isActive: true,
          lastSyncedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // YouTube (for some)
      if (Math.random() > 0.5) {
        socialAccounts.push({
          id: uuidv4(),
          creatorId: creator.id,
          platform: 'youtube',
          username: creator.displayName,
          profileUrl: `https://youtube.com/@${creator.displayName}`,
          followersCount: Math.floor(followerBase * (0.3 + Math.random() * 0.5)),
          followingCount: 0,
          postsCount: Math.floor(20 + Math.random() * 100),
          engagementRate: 2 + Math.random() * 3,
          verified: creator.tier === 'elite',
          isActive: true,
          lastSyncedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Twitter (for some)
      if (Math.random() > 0.4) {
        socialAccounts.push({
          id: uuidv4(),
          creatorId: creator.id,
          platform: 'twitter',
          username: creator.displayName.toLowerCase(),
          profileUrl: `https://twitter.com/${creator.displayName.toLowerCase()}`,
          followersCount: Math.floor(followerBase * (0.4 + Math.random() * 0.6)),
          followingCount: Math.floor(followerBase * 0.3),
          postsCount: Math.floor(500 + Math.random() * 2000),
          engagementRate: 1.5 + Math.random() * 2.5,
          verified: creator.tier === 'elite' || creator.tier === 'premium',
          isActive: true,
          lastSyncedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    await queryInterface.bulkInsert('SocialAccounts', socialAccounts, {});

    console.log(`Seeded ${users.length} demo creator users`);
    console.log(`Seeded ${creators.length} demo creator profiles`);
    console.log(`Seeded ${rateCards.length} rate cards`);
    console.log(`Seeded ${socialAccounts.length} social accounts`);
  },

  async down(queryInterface, Sequelize) {
    // Delete in reverse order due to foreign keys
    await queryInterface.bulkDelete('SocialAccounts', null, {});
    await queryInterface.bulkDelete('RateCards', null, {});
    await queryInterface.bulkDelete('Creators', null, {});
    await queryInterface.sequelize.query(
      `DELETE FROM "Users" WHERE email LIKE '%@demo.creatorsworld.ng'`
    );
  }
};

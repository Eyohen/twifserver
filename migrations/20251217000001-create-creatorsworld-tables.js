'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Enable UUID extension
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // 1. Create Regions table
    await queryInterface.createTable('Regions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        unique: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 2. Create States table
    await queryInterface.createTable('States', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      regionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Regions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        unique: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 3. Create Cities table
    await queryInterface.createTable('Cities', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      stateId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'States', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 4. Create Categories table
    await queryInterface.createTable('Categories', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      icon: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      parentId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 5. Create Industries table
    await queryInterface.createTable('Industries', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      icon: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 6. Create Users table
    await queryInterface.createTable('Users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      userType: {
        type: Sequelize.ENUM('creator', 'brand'),
        allowNull: false
      },
      verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      verificationToken: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      verificationTokenExpires: {
        type: Sequelize.DATE,
        allowNull: true
      },
      resetPasswordToken: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      resetPasswordExpires: {
        type: Sequelize.DATE,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'suspended', 'pending_verification'),
        defaultValue: 'pending_verification'
      },
      onboardingCompleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      onboardingStep: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      lastLoginAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      refreshToken: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 7. Create Admins table
    await queryInterface.createTable('Admins', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      firstName: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      lastName: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      role: {
        type: Sequelize.ENUM('super_admin', 'admin', 'moderator', 'support'),
        defaultValue: 'admin'
      },
      permissions: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        defaultValue: 'active'
      },
      lastLoginAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      refreshToken: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 8. Create Creators table
    await queryInterface.createTable('Creators', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      firstName: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      lastName: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      displayName: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      bio: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      profileImage: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      coverImage: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      regionId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Regions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      stateId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'States', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      cityId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Cities', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      primaryNicheId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      secondaryNiches: {
        type: Sequelize.ARRAY(Sequelize.UUID),
        defaultValue: []
      },
      yearsOfExperience: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      languages: {
        type: Sequelize.ARRAY(Sequelize.STRING(50)),
        defaultValue: ['English']
      },
      tier: {
        type: Sequelize.ENUM('rising', 'verified', 'premium', 'elite'),
        defaultValue: 'rising'
      },
      tierPoints: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      commissionRate: {
        type: Sequelize.DECIMAL(5, 4),
        defaultValue: 0.20
      },
      verificationStatus: {
        type: Sequelize.ENUM('unverified', 'pending', 'verified', 'rejected'),
        defaultValue: 'unverified'
      },
      verificationDocuments: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      verifiedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      arconCompliant: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      availabilityStatus: {
        type: Sequelize.ENUM('available', 'busy', 'not_accepting'),
        defaultValue: 'available'
      },
      responseTime: {
        type: Sequelize.ENUM('within_24h', 'within_48h', 'within_week'),
        defaultValue: 'within_48h'
      },
      leadTimeDays: {
        type: Sequelize.INTEGER,
        defaultValue: 3
      },
      totalEarnings: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      pendingEarnings: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      availableBalance: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      completedCollaborations: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      averageRating: {
        type: Sequelize.DECIMAL(3, 2),
        defaultValue: 0
      },
      totalReviews: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      profileViews: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      acceptsNegotiation: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      minimumBudget: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      contentPreferences: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      restrictedCategories: {
        type: Sequelize.ARRAY(Sequelize.STRING(100)),
        defaultValue: []
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 9. Create Brands table
    await queryInterface.createTable('Brands', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      companyName: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      businessType: {
        type: Sequelize.ENUM('startup', 'sme', 'enterprise', 'agency', 'individual'),
        allowNull: false
      },
      industryId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Industries', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      website: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      logo: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      contactFirstName: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      contactLastName: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      contactPosition: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      regionId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Regions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      stateId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'States', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      cityId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Cities', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      tier: {
        type: Sequelize.ENUM('starter', 'growth', 'business', 'enterprise'),
        defaultValue: 'starter'
      },
      tierExpiresAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      monthlyBudget: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      cacRegistered: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      cacNumber: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      verificationStatus: {
        type: Sequelize.ENUM('unverified', 'pending', 'verified'),
        defaultValue: 'unverified'
      },
      verificationDocuments: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      totalSpent: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      completedCollaborations: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      averageRating: {
        type: Sequelize.DECIMAL(3, 2),
        defaultValue: 0
      },
      totalReviews: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      messagesUsedThisMonth: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      activeCampaignsCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      preferredNiches: {
        type: Sequelize.ARRAY(Sequelize.UUID),
        defaultValue: []
      },
      preferredPlatforms: {
        type: Sequelize.ARRAY(Sequelize.STRING(50)),
        defaultValue: []
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 10. Create SocialAccounts table
    await queryInterface.createTable('SocialAccounts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      creatorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Creators', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      platform: {
        type: Sequelize.ENUM('instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin', 'snapchat', 'threads'),
        allowNull: false
      },
      username: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      profileUrl: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      followersCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      followingCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      postsCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      engagementRate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      accessToken: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      refreshToken: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      tokenExpiresAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      lastSyncedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      metrics: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add unique constraint for creatorId + platform
    await queryInterface.addIndex('SocialAccounts', ['creatorId', 'platform'], {
      unique: true,
      name: 'social_accounts_creator_platform_unique'
    });

    // 11. Create PortfolioItems table
    await queryInterface.createTable('PortfolioItems', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      creatorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Creators', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      mediaType: {
        type: Sequelize.ENUM('image', 'video', 'link'),
        allowNull: false
      },
      mediaUrl: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      thumbnailUrl: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      platform: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      brandName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      campaignType: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      results: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      isPublic: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      isFeatured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 12. Create RateCards table
    await queryInterface.createTable('RateCards', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      creatorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Creators', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      platform: {
        type: Sequelize.ENUM('instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin', 'blog', 'podcast', 'other'),
        allowNull: false
      },
      contentType: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      priceType: {
        type: Sequelize.ENUM('fixed', 'range', 'starting_from', 'contact'),
        defaultValue: 'fixed'
      },
      basePrice: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      maxPrice: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'NGN'
      },
      deliveryDays: {
        type: Sequelize.INTEGER,
        defaultValue: 7
      },
      revisionsIncluded: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      usageRightsDays: {
        type: Sequelize.INTEGER,
        defaultValue: 30
      },
      includes: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      addOns: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 13. Create ServicePackages table
    await queryInterface.createTable('ServicePackages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      creatorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Creators', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      packageType: {
        type: Sequelize.ENUM('starter', 'standard', 'premium', 'custom'),
        defaultValue: 'standard'
      },
      price: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      originalPrice: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      discountPercentage: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'NGN'
      },
      deliveryDays: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      maxRevisions: {
        type: Sequelize.INTEGER,
        defaultValue: 2
      },
      includedServices: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      features: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      isFeatured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 14. Create LegalClauses table
    await queryInterface.createTable('LegalClauses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      creatorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Creators', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      clauseType: {
        type: Sequelize.ENUM('usage_rights', 'exclusivity', 'payment', 'termination', 'confidentiality', 'revision_policy', 'cancellation', 'custom'),
        allowNull: false
      },
      isDefault: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      applyToAll: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      appliedServices: {
        type: Sequelize.ARRAY(Sequelize.UUID),
        defaultValue: []
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 15. Create BankAccounts table
    await queryInterface.createTable('BankAccounts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      bankName: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      bankCode: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      accountNumber: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      accountName: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      accountType: {
        type: Sequelize.ENUM('savings', 'current'),
        defaultValue: 'savings'
      },
      paystackRecipientCode: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      paystackBankId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      isDefault: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      verifiedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 16. Create CollaborationRequests table
    await queryInterface.createTable('CollaborationRequests', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      referenceNumber: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },
      brandId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Brands', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      creatorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Creators', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      objectives: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      deliverables: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      targetPlatforms: {
        type: Sequelize.ARRAY(Sequelize.STRING(50)),
        allowNull: false
      },
      contentRequirements: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      hashtags: {
        type: Sequelize.ARRAY(Sequelize.STRING(100)),
        defaultValue: []
      },
      mentions: {
        type: Sequelize.ARRAY(Sequelize.STRING(100)),
        defaultValue: []
      },
      dosAndDonts: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      brandAssets: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      proposedBudget: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      negotiatedBudget: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      finalBudget: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'NGN'
      },
      proposedStartDate: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      proposedEndDate: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      actualStartDate: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      actualEndDate: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      draftDeadline: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      deadlineFlexible: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      isRushDelivery: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      status: {
        type: Sequelize.ENUM(
          'draft', 'pending', 'viewed', 'negotiating', 'accepted',
          'contract_pending', 'contract_signed', 'payment_pending',
          'in_progress', 'content_submitted', 'revision_requested',
          'completed', 'cancelled', 'declined', 'disputed', 'expired'
        ),
        defaultValue: 'draft'
      },
      brandNotes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      creatorNotes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      declineReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      declineCategory: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      cancelReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      cancelledBy: {
        type: Sequelize.ENUM('brand', 'creator', 'admin'),
        allowNull: true
      },
      submittedContent: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      revisionCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      maxRevisions: {
        type: Sequelize.INTEGER,
        defaultValue: 2
      },
      revisionNotes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      viewedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      respondedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      acceptedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      contentSubmittedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      negotiationRounds: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      maxNegotiationRounds: {
        type: Sequelize.INTEGER,
        defaultValue: 3
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 17. Create RequestNegotiations table
    await queryInterface.createTable('RequestNegotiations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      requestId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'CollaborationRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      initiatedBy: {
        type: Sequelize.ENUM('brand', 'creator'),
        allowNull: false
      },
      roundNumber: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      proposedBudget: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      proposedStartDate: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      proposedEndDate: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      proposedDeliverables: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'accepted', 'countered', 'declined'),
        defaultValue: 'pending'
      },
      responseMessage: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      respondedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 18. Create AvailabilitySlots table
    await queryInterface.createTable('AvailabilitySlots', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      creatorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Creators', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      startDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      endDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      isAvailable: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      reason: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      slotType: {
        type: Sequelize.ENUM('blocked', 'booked', 'tentative'),
        defaultValue: 'blocked'
      },
      requestId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'CollaborationRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 19. Create ContractTemplates table
    await queryInterface.createTable('ContractTemplates', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      variables: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      sections: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      isDefault: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      version: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Admins', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      updatedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Admins', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 20. Create Contracts table
    await queryInterface.createTable('Contracts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      contractNumber: {
        type: Sequelize.STRING(30),
        allowNull: false,
        unique: true
      },
      requestId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'CollaborationRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      brandId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Brands', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      creatorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Creators', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      templateId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'ContractTemplates', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      terms: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      deliverables: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      paymentTerms: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      platformClauses: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      brandClauses: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      creatorClauses: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      brandSignature: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      brandSignedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      brandSignedIP: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      brandSignerName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      creatorSignature: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      creatorSignedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      creatorSignedIP: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      creatorSignerName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('draft', 'pending_brand', 'pending_creator', 'active', 'completed', 'terminated', 'disputed'),
        defaultValue: 'draft'
      },
      arconCompliance: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      arconApprovalNumber: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      effectiveDate: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      expiryDate: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      terminatedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      terminatedBy: {
        type: Sequelize.ENUM('brand', 'creator', 'admin', 'system'),
        allowNull: true
      },
      terminationReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      pdfUrl: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 21. Create Payments table
    await queryInterface.createTable('Payments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      referenceNumber: {
        type: Sequelize.STRING(30),
        allowNull: false,
        unique: true
      },
      requestId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'CollaborationRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      contractId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Contracts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      brandId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Brands', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      creatorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Creators', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      platformFee: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      platformFeePercentage: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false
      },
      creatorPayout: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'NGN'
      },
      paystackReference: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      paystackAccessCode: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      paystackAuthorizationUrl: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      paystackTransactionId: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM(
          'pending', 'initialized', 'escrow', 'processing',
          'released', 'completed', 'refunded', 'partially_refunded',
          'failed', 'disputed', 'cancelled'
        ),
        defaultValue: 'pending'
      },
      escrowAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      escrowReleasedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      escrowReleasedBy: {
        type: Sequelize.UUID,
        allowNull: true
      },
      releaseType: {
        type: Sequelize.ENUM('automatic', 'manual', 'dispute_resolution'),
        allowNull: true
      },
      paymentMethod: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      paymentChannel: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      cardType: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      cardLast4: {
        type: Sequelize.STRING(4),
        allowNull: true
      },
      bankName: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      paidAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      refundedAmount: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      refundReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      refundedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      failureReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 22. Create Payouts table
    await queryInterface.createTable('Payouts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      referenceNumber: {
        type: Sequelize.STRING(30),
        allowNull: false,
        unique: true
      },
      creatorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Creators', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      bankAccountId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'BankAccounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'NGN'
      },
      paystackTransferCode: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      paystackRecipientCode: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      paystackTransferId: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed', 'reversed'),
        defaultValue: 'pending'
      },
      processedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      failureReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      bankName: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      accountNumber: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      accountName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 23. Create Conversations table
    await queryInterface.createTable('Conversations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      requestId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'CollaborationRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      brandId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Brands', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      creatorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Creators', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      lastMessageAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      lastMessagePreview: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      brandUnreadCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      creatorUnreadCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      brandArchivedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      creatorArchivedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 24. Create Messages table
    await queryInterface.createTable('Messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      conversationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Conversations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      senderId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      senderType: {
        type: Sequelize.ENUM('brand', 'creator', 'system'),
        allowNull: false
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      messageType: {
        type: Sequelize.ENUM('text', 'image', 'file', 'system', 'request_update'),
        defaultValue: 'text'
      },
      attachments: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      isRead: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      readAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      isDeleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 25. Create Reviews table
    await queryInterface.createTable('Reviews', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      requestId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'CollaborationRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      reviewerId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      reviewerType: {
        type: Sequelize.ENUM('brand', 'creator'),
        allowNull: false
      },
      revieweeId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      revieweeType: {
        type: Sequelize.ENUM('brand', 'creator'),
        allowNull: false
      },
      rating: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      communicationRating: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      qualityRating: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      professionalismRating: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      timelinessRating: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      isPublic: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      response: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      respondedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      isApproved: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      isFlagged: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      flagReason: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 26. Create Notifications table
    await queryInterface.createTable('Notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      referenceType: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      referenceId: {
        type: Sequelize.UUID,
        allowNull: true
      },
      actionUrl: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      isRead: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      readAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      emailSent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      emailSentAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      pushSent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      pushSentAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      priority: {
        type: Sequelize.ENUM('low', 'normal', 'high'),
        defaultValue: 'normal'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 27. Create SavedCreators table
    await queryInterface.createTable('SavedCreators', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      brandId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Brands', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      creatorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Creators', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      tags: {
        type: Sequelize.ARRAY(Sequelize.STRING(50)),
        defaultValue: []
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add unique constraint
    await queryInterface.addIndex('SavedCreators', ['brandId', 'creatorId'], {
      unique: true,
      name: 'saved_creators_brand_creator_unique'
    });

    // 28. Create TierConfigurations table
    await queryInterface.createTable('TierConfigurations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      userType: {
        type: Sequelize.ENUM('creator', 'brand'),
        allowNull: false
      },
      tierName: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      tierLevel: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      minDaysActive: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      minCompletedDeals: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      minEarnings: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      minRating: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true
      },
      minResponseRate: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      commissionRate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true
      },
      searchBoostPercentage: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      portfolioItemLimit: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      withdrawalDays: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      verifiedBadge: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      featuredPlacement: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      monthlyPrice: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      yearlyPrice: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      monthlyMessageLimit: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      activeCampaignLimit: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      searchResultsLimit: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      platformFeePercentage: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true
      },
      prioritySupport: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      supportResponseHours: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      aiMatching: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      additionalBenefits: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      badgeIcon: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      badgeColor: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add unique constraint
    await queryInterface.addIndex('TierConfigurations', ['userType', 'tierName'], {
      unique: true,
      name: 'tier_config_user_tier_unique'
    });

    // 29. Create PlatformSettings table
    await queryInterface.createTable('PlatformSettings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      value: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      dataType: {
        type: Sequelize.ENUM('string', 'number', 'boolean', 'json'),
        defaultValue: 'string'
      },
      category: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      isPublic: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      updatedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Admins', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 30. Create AuditLogs table
    await queryInterface.createTable('AuditLogs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      adminId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Admins', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      action: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      entity: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      entityId: {
        type: Sequelize.UUID,
        allowNull: true
      },
      previousData: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      newData: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      ipAddress: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('Creators', ['tier']);
    await queryInterface.addIndex('Creators', ['verificationStatus']);
    await queryInterface.addIndex('Creators', ['availabilityStatus']);
    await queryInterface.addIndex('Creators', ['primaryNicheId']);
    await queryInterface.addIndex('Creators', ['stateId']);
    await queryInterface.addIndex('Creators', ['averageRating']);

    await queryInterface.addIndex('Brands', ['tier']);
    await queryInterface.addIndex('Brands', ['industryId']);
    await queryInterface.addIndex('Brands', ['stateId']);

    await queryInterface.addIndex('CollaborationRequests', ['brandId']);
    await queryInterface.addIndex('CollaborationRequests', ['creatorId']);
    await queryInterface.addIndex('CollaborationRequests', ['status']);

    await queryInterface.addIndex('Payments', ['brandId']);
    await queryInterface.addIndex('Payments', ['creatorId']);
    await queryInterface.addIndex('Payments', ['status']);

    await queryInterface.addIndex('Conversations', ['brandId']);
    await queryInterface.addIndex('Conversations', ['creatorId']);

    await queryInterface.addIndex('Messages', ['conversationId']);

    await queryInterface.addIndex('Notifications', ['userId']);
    await queryInterface.addIndex('Notifications', ['isRead']);

    await queryInterface.addIndex('Reviews', ['revieweeId', 'revieweeType']);
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order
    await queryInterface.dropTable('AuditLogs');
    await queryInterface.dropTable('PlatformSettings');
    await queryInterface.dropTable('TierConfigurations');
    await queryInterface.dropTable('SavedCreators');
    await queryInterface.dropTable('Notifications');
    await queryInterface.dropTable('Reviews');
    await queryInterface.dropTable('Messages');
    await queryInterface.dropTable('Conversations');
    await queryInterface.dropTable('Payouts');
    await queryInterface.dropTable('Payments');
    await queryInterface.dropTable('Contracts');
    await queryInterface.dropTable('ContractTemplates');
    await queryInterface.dropTable('AvailabilitySlots');
    await queryInterface.dropTable('RequestNegotiations');
    await queryInterface.dropTable('CollaborationRequests');
    await queryInterface.dropTable('BankAccounts');
    await queryInterface.dropTable('LegalClauses');
    await queryInterface.dropTable('ServicePackages');
    await queryInterface.dropTable('RateCards');
    await queryInterface.dropTable('PortfolioItems');
    await queryInterface.dropTable('SocialAccounts');
    await queryInterface.dropTable('Brands');
    await queryInterface.dropTable('Creators');
    await queryInterface.dropTable('Admins');
    await queryInterface.dropTable('Users');
    await queryInterface.dropTable('Industries');
    await queryInterface.dropTable('Categories');
    await queryInterface.dropTable('Cities');
    await queryInterface.dropTable('States');
    await queryInterface.dropTable('Regions');

    // Drop ENUM types
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Users_userType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Users_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Admins_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Admins_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Creators_tier";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Creators_verificationStatus";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Creators_availabilityStatus";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Creators_responseTime";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Brands_businessType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Brands_tier";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Brands_verificationStatus";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_SocialAccounts_platform";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PortfolioItems_mediaType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_RateCards_platform";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_RateCards_priceType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ServicePackages_packageType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_LegalClauses_clauseType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_BankAccounts_accountType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_CollaborationRequests_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_CollaborationRequests_cancelledBy";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_RequestNegotiations_initiatedBy";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_RequestNegotiations_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_AvailabilitySlots_slotType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Contracts_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Contracts_terminatedBy";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Payments_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Payments_releaseType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Payouts_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Messages_senderType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Messages_messageType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Reviews_reviewerType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Reviews_revieweeType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Notifications_priority";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_TierConfigurations_userType";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PlatformSettings_dataType";');
  }
};

require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('../models');

const {
  User,
  PersonalProfile,
  BusinessProfile,
  Connection,
  Opportunity,
  OpportunityInterest,
  sequelize,
} = db;

const SHARED_PASSWORD = 'Password123!';

const personalAccounts = [
  ['maya.okonkwo@test.twif.local', 'Maya', 'Okonkwo', 'Startup advisor and angel investor', 'I help early-stage founders refine partnerships, fundraising strategy, and market entry.'],
  ['david.mensah@test.twif.local', 'David', 'Mensah', 'Procurement and vendor sourcing lead', 'I source reliable vendors for enterprise projects across West Africa.'],
  ['amina.bello@test.twif.local', 'Amina', 'Bello', 'Product manager exploring partnerships', 'I build digital products and seek strategic product and distribution partners.'],
  ['kwame.boateng@test.twif.local', 'Kwame', 'Boateng', 'Investment analyst', 'I evaluate growth companies and connect founders with sector-focused capital.'],
  ['sarah.njeri@test.twif.local', 'Sarah', 'Njeri', 'Operations consultant', 'I support SMEs with operating systems, process design, and expansion planning.'],
  ['tunde.adeleke@test.twif.local', 'Tunde', 'Adeleke', 'Software engineer and API specialist', 'I build integrations, internal tools, and B2B workflow automation.'],
  ['linda.moyo@test.twif.local', 'Linda', 'Moyo', 'Business development strategist', 'I help companies identify partnerships, channels, and market-entry opportunities.'],
  ['yusuf.diallo@test.twif.local', 'Yusuf', 'Diallo', 'Logistics and trade facilitator', 'I connect importers, exporters, and logistics providers across African trade corridors.'],
  ['chika.eze@test.twif.local', 'Chika', 'Eze', 'Talent and job placement partner', 'I help companies source specialist talent for technology and operations roles.'],
  ['elena.kimani@test.twif.local', 'Elena', 'Kimani', 'Healthcare partnerships consultant', 'I support health-tech collaborations, pilots, and ecosystem partnerships.'],
];

const businessAccounts = [
  ['techventures@test.twif.local', 'TechVentures Inc.', 'Daniel Cole', 'startup', 'Technology', 'Building enterprise SaaS products and API infrastructure for African businesses.', 'Lagos', 'Nigeria'],
  ['greenscale@test.twif.local', 'GreenScale Solutions', 'Nora Abebe', 'sme', 'Healthcare', 'Health-tech company building digital care and community health platforms.', 'Nairobi', 'Kenya'],
  ['atlascapital@test.twif.local', 'Atlas Capital Group', 'Kojo Annan', 'enterprise', 'Finance', 'Investment firm backing high-growth B2B companies across Africa.', 'Accra', 'Ghana'],
  ['bloomstrategy@test.twif.local', 'Bloom Strategy', 'Fatima Yusuf', 'agency', 'Marketing', 'Growth strategy agency helping B2B companies launch and scale.', 'Cape Town', 'South Africa'],
  ['novabridge@test.twif.local', 'NovaBridge Labs', 'Eric Habineza', 'startup', 'Technology', 'AI research and product lab seeking commercialization partners.', 'Kigali', 'Rwanda'],
  ['meridianlogistics@test.twif.local', 'Meridian Logistics', 'Ada Balogun', 'enterprise', 'Manufacturing', 'Supply chain and warehousing operator supporting regional trade.', 'Lagos', 'Nigeria'],
  ['eduprime@test.twif.local', 'EduPrime Africa', 'Grace Wambui', 'sme', 'Education', 'Digital learning platform for professional upskilling and enterprise training.', 'Kampala', 'Uganda'],
  ['keystonepartners@test.twif.local', 'Keystone Partners', 'Samuel Otieno', 'agency', 'Finance', 'Corporate finance and M&A advisory firm for mid-market companies.', 'Dar es Salaam', 'Tanzania'],
  ['nexusdigital@test.twif.local', 'Nexus Digital', 'Ifeoma Umeh', 'agency', 'Marketing', 'Digital transformation and customer acquisition agency for SMEs.', 'Abuja', 'Nigeria'],
  ['vantageanalytics@test.twif.local', 'Vantage Analytics', 'Peter Kamau', 'startup', 'Technology', 'Data analytics company helping enterprises turn operational data into decisions.', 'Nairobi', 'Kenya'],
];

const opportunities = [
  ['techventures@test.twif.local', 'Looking for SaaS Integration Partner', 'Partnerships', 'We need a partner to integrate our CRM and workflow tools with enterprise platforms across finance and retail.', '$10k - $25k', 'Remote'],
  ['meridianlogistics@test.twif.local', 'Warehouse Management Vendor Needed', 'Vendor Sourcing', 'Seeking a reliable vendor for warehouse management system rollout across three locations.', '$50k - $100k', 'Lagos, Nigeria'],
  ['eduprime@test.twif.local', 'Joint Venture: EdTech Expansion into East Africa', 'Joint Ventures', 'Looking for a partner to co-invest and co-develop our digital learning platform for East African markets.', 'Equity partnership', 'East Africa'],
  ['novabridge@test.twif.local', 'Marketing Strategy Consultant for AI Product Launch', 'Contracts', 'Need an experienced B2B marketing consultant to develop and execute go-to-market strategy for a new AI product.', '$15k - $30k', 'Remote'],
  ['greenscale@test.twif.local', 'Seed Investment Round: HealthTech Platform', 'Investment', 'Raising a seed round for our health-tech platform and looking for investors with healthcare or impact experience.', '$500k raise', 'Nairobi, Kenya'],
  ['keystonepartners@test.twif.local', 'Financial Advisory Services Contract', 'Contracts', 'Seeking a finance advisory partner for an upcoming manufacturing-sector M&A transaction.', 'Negotiable', 'Dar es Salaam, Tanzania'],
];

const upsertUser = async ({ email, passwordHash, userType }, transaction) => {
  const [user] = await User.findOrCreate({
    where: { email },
    defaults: {
      email,
      password: passwordHash,
      userType,
      verified: true,
      status: 'active',
      verificationToken: null,
      verificationTokenExpires: null,
      onboardingCompleted: true,
      onboardingStep: 3,
    },
    transaction,
  });

  await user.update({
    password: passwordHash,
    userType,
    verified: true,
    status: 'active',
    verificationToken: null,
    verificationTokenExpires: null,
    onboardingCompleted: true,
    onboardingStep: 3,
  }, { transaction });

  return user;
};

const seed = async () => {
  let transaction;

  try {
    await sequelize.sync({ alter: true });
    transaction = await sequelize.transaction();
    const passwordHash = await bcrypt.hash(SHARED_PASSWORD, 12);
    const usersByEmail = new Map();

    for (const [email, firstName, lastName, headline, bio] of personalAccounts) {
      const user = await upsertUser({ email, passwordHash, userType: 'personal' }, transaction);
      await PersonalProfile.upsert({
        userId: user.id,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        headline,
        bio,
        phone: '+234 700 000 0000',
        website: 'https://twif.example.com',
        country: 'Nigeria',
        state: 'Lagos',
        city: 'Lagos',
        address: 'Twif Test Workspace',
        onboardingStep: 3,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
      }, { transaction });
      usersByEmail.set(email, user);
    }

    for (const [email, businessName, contactName, businessType, industry, description, city, country] of businessAccounts) {
      const user = await upsertUser({ email, passwordHash, userType: 'business' }, transaction);
      await BusinessProfile.upsert({
        userId: user.id,
        businessName,
        contactName,
        businessType,
        industry,
        description,
        phone: '+234 701 000 0000',
        website: `https://${businessName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example.com`,
        country,
        state: city,
        city,
        address: `${city} business district`,
        onboardingStep: 3,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
      }, { transaction });
      usersByEmail.set(email, user);
    }

    for (const [email, title, category, description, budget, location] of opportunities) {
      const owner = usersByEmail.get(email);
      await Opportunity.findOrCreate({
        where: { ownerId: owner.id, title },
        defaults: {
          ownerId: owner.id,
          title,
          category,
          description,
          budget,
          location,
          status: 'active',
        },
        transaction,
      });
    }

    const connectionPairs = [
      ['maya.okonkwo@test.twif.local', 'techventures@test.twif.local', 'connected'],
      ['david.mensah@test.twif.local', 'meridianlogistics@test.twif.local', 'connected'],
      ['amina.bello@test.twif.local', 'novabridge@test.twif.local', 'connected'],
      ['kwame.boateng@test.twif.local', 'atlascapital@test.twif.local', 'connected'],
      ['greenscale@test.twif.local', 'elena.kimani@test.twif.local', 'pending'],
      ['keystonepartners@test.twif.local', 'maya.okonkwo@test.twif.local', 'pending'],
      ['tunde.adeleke@test.twif.local', 'vantageanalytics@test.twif.local', 'pending'],
      ['bloomstrategy@test.twif.local', 'linda.moyo@test.twif.local', 'pending'],
    ];

    for (const [requesterEmail, recipientEmail, status] of connectionPairs) {
      const requester = usersByEmail.get(requesterEmail);
      const recipient = usersByEmail.get(recipientEmail);
      const [connection] = await Connection.findOrCreate({
        where: { requesterId: requester.id, recipientId: recipient.id },
        defaults: {
          requesterId: requester.id,
          recipientId: recipient.id,
          status,
          message: 'Seeded test connection',
          respondedAt: status === 'connected' ? new Date() : null,
        },
        transaction,
      });
      await connection.update({
        status,
        respondedAt: status === 'connected' ? new Date() : null,
      }, { transaction });
    }

    const firstOpportunity = await Opportunity.findOne({ transaction });
    const interestedUser = usersByEmail.get('sarah.njeri@test.twif.local');
    if (firstOpportunity && interestedUser) {
      await OpportunityInterest.findOrCreate({
        where: { opportunityId: firstOpportunity.id, userId: interestedUser.id },
        defaults: {
          opportunityId: firstOpportunity.id,
          userId: interestedUser.id,
          message: 'I can support this opportunity and would like to discuss the scope.',
          contactPreference: 'Platform Message',
        },
        transaction,
      });
    }

    await transaction.commit();

    console.log('\nTwif test accounts seeded successfully.');
    console.log(`Shared password: ${SHARED_PASSWORD}`);
    console.log('\nSample accounts:');
    console.log('- maya.okonkwo@test.twif.local');
    console.log('- techventures@test.twif.local');
    console.log('- greenscale@test.twif.local');
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('Failed to seed Twif test accounts:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

seed();

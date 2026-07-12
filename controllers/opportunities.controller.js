const db = require('../models');
const { formatUserSummary, getProfileName } = require('../utils/profileFormatter');
const { createNotification } = require('../services/notification.service');

const { Opportunity, OpportunityInterest, User, PersonalProfile, BusinessProfile } = db;

const includeOwner = [
  {
    model: User,
    as: 'owner',
    attributes: ['id', 'email', 'userType', 'verified'],
    include: [
      { model: PersonalProfile, as: 'personalProfile', required: false },
      { model: BusinessProfile, as: 'businessProfile', required: false },
    ],
  },
  { model: OpportunityInterest, as: 'interests', attributes: ['id'], required: false },
];

const formatOpportunity = (opportunity) => ({
  id: opportunity.id,
  title: opportunity.title,
  category: opportunity.category,
  description: opportunity.description,
  budget: opportunity.budget,
  location: opportunity.location || 'Remote',
  status: opportunity.status,
  createdAt: opportunity.createdAt,
  responsesCount: opportunity.interests?.length || 0,
  owner: formatUserSummary(opportunity.owner),
});

const findUserWithProfile = (id) => User.findByPk(id, {
  attributes: ['id', 'email', 'userType', 'verified'],
  include: [
    { model: PersonalProfile, as: 'personalProfile', required: false },
    { model: BusinessProfile, as: 'businessProfile', required: false },
  ],
});

exports.listOpportunities = async (req, res) => {
  try {
    const opportunities = await Opportunity.findAll({
      where: { status: 'active' },
      include: includeOwner,
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    return res.json({
      success: true,
      data: opportunities.map(formatOpportunity),
    });
  } catch (error) {
    console.error('List opportunities error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load opportunities' });
  }
};

exports.createOpportunity = async (req, res) => {
  try {
    const { title, category, description, budget, location } = req.body;

    if (!title || !category || !description) {
      return res.status(400).json({ success: false, message: 'Title, category, and description are required' });
    }

    const opportunity = await Opportunity.create({
      ownerId: req.user.id,
      title,
      category,
      description,
      budget: budget || null,
      location: location || null,
      status: 'active',
    });

    const created = await Opportunity.findByPk(opportunity.id, { include: includeOwner });
    return res.status(201).json({ success: true, message: 'Opportunity posted', data: formatOpportunity(created) });
  } catch (error) {
    console.error('Create opportunity error:', error);
    return res.status(500).json({ success: false, message: 'Failed to post opportunity' });
  }
};

exports.submitInterest = async (req, res) => {
  try {
    const { message, contactPreference = 'Platform Message' } = req.body;
    const opportunity = await Opportunity.findOne({
      where: { id: req.params.id, status: 'active' },
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'email', 'userType', 'verified'],
          include: [
            { model: PersonalProfile, as: 'personalProfile', required: false },
            { model: BusinessProfile, as: 'businessProfile', required: false },
          ],
        },
      ],
    });

    if (!opportunity) {
      return res.status(404).json({ success: false, message: 'Opportunity not found' });
    }

    if (opportunity.ownerId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot express interest in your own opportunity' });
    }

    if (!message || message.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Message must be at least 10 characters' });
    }

    const [interest, created] = await OpportunityInterest.findOrCreate({
      where: { opportunityId: opportunity.id, userId: req.user.id },
      defaults: {
        message,
        contactPreference,
        status: 'submitted',
      },
    });

    if (!created) {
      await interest.update({ message, contactPreference, status: 'submitted' });
    }

    const interestedUser = await findUserWithProfile(req.user.id);
    const interestedUserName = getProfileName(interestedUser);

    await createNotification({
      userId: opportunity.ownerId,
      type: 'opportunity_interest',
      title: created ? 'New opportunity interest' : 'Opportunity interest updated',
      message: `${interestedUserName} ${created ? 'expressed interest in' : 'updated their interest in'} "${opportunity.title}".`,
      referenceType: 'opportunity',
      referenceId: opportunity.id,
      actionUrl: '/dashboard/opportunities',
      priority: 'high',
      metadata: { interestId: interest.id, interestedUserId: req.user.id },
      ctaLabel: 'Review opportunity'
    });

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Interest submitted' : 'Interest updated',
      data: interest,
    });
  } catch (error) {
    console.error('Submit opportunity interest error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit interest' });
  }
};

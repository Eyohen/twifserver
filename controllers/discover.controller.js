const { Op } = require('sequelize');
const db = require('../models');
const { formatUserSummary } = require('../utils/profileFormatter');

const { User, PersonalProfile, BusinessProfile, Connection } = db;

const includeProfiles = [
  { model: PersonalProfile, as: 'personalProfile', required: false },
  { model: BusinessProfile, as: 'businessProfile', required: false },
];

const getConnectionStatusMap = async (userId, targetIds) => {
  const connections = await Connection.findAll({
    where: {
      [Op.or]: [
        { requesterId: userId, recipientId: { [Op.in]: targetIds } },
        { recipientId: userId, requesterId: { [Op.in]: targetIds } },
      ],
    },
  });

  return connections.reduce((map, connection) => {
    const otherUserId = connection.requesterId === userId ? connection.recipientId : connection.requesterId;
    if (connection.status === 'pending') {
      map[otherUserId] = connection.requesterId === userId ? 'sent' : 'received';
    } else if (connection.status === 'connected') {
      map[otherUserId] = 'connected';
    }
    return map;
  }, {});
};

exports.listDiscoverProfiles = async (req, res) => {
  try {
    const users = await User.findAll({
      where: {
        id: { [Op.ne]: req.user.id },
        status: 'active',
        verified: true,
      },
      attributes: ['id', 'email', 'userType', 'verified', 'createdAt'],
      include: includeProfiles,
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    const connectionStatusMap = await getConnectionStatusMap(req.user.id, users.map((user) => user.id));
    const currentProfile = req.user.userType === 'business'
      ? await BusinessProfile.findOne({ where: { userId: req.user.id } })
      : await PersonalProfile.findOne({ where: { userId: req.user.id } });

    const currentIndustry = req.user.userType === 'business'
      ? currentProfile?.industry
      : currentProfile?.headline;

    const data = users.map((user, index) => {
      const summary = formatUserSummary(user, {
        connectionStatus: connectionStatusMap[user.id] || 'none',
      });
      const sameIndustry = currentIndustry && summary.industry && String(summary.industry).toLowerCase().includes(String(currentIndustry).toLowerCase());
      const match = Math.max(62, Math.min(96, 88 - index * 3 + (sameIndustry ? 8 : 0)));

      return { ...summary, match };
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error('List discover profiles error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load discover profiles' });
  }
};

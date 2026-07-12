const db = require('../models');
const { Region, State, City, Category, Industry, TierConfiguration } = db;

// Get regions
exports.getRegions = async (req, res) => {
  try {
    const regions = await Region.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: regions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get regions' });
  }
};

// Get all states
exports.getStates = async (req, res) => {
  try {
    const states = await State.findAll({
      where: { isActive: true },
      include: [{ model: Region, as: 'region' }],
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: states });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get states' });
  }
};

// Get states by region
exports.getStatesByRegion = async (req, res) => {
  try {
    const { regionId } = req.params;
    const states = await State.findAll({
      where: { regionId, isActive: true },
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: states });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get states' });
  }
};

// Get all cities
exports.getCities = async (req, res) => {
  try {
    const cities = await City.findAll({
      where: { isActive: true },
      include: [{ model: State, as: 'state' }],
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: cities });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get cities' });
  }
};

// Get cities by state
exports.getCitiesByState = async (req, res) => {
  try {
    const { stateId } = req.params;
    const cities = await City.findAll({
      where: { stateId, isActive: true },
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: cities });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get cities' });
  }
};

// Get categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get categories' });
  }
};

// Get category by ID
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get category' });
  }
};

// Get industries
exports.getIndustries = async (req, res) => {
  try {
    const industries = await Industry.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: industries });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get industries' });
  }
};

// Get industry by ID
exports.getIndustryById = async (req, res) => {
  try {
    const industry = await Industry.findByPk(req.params.id);
    if (!industry) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: industry });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get industry' });
  }
};

// Get creator tiers
exports.getCreatorTiers = async (req, res) => {
  try {
    const tiers = await TierConfiguration.findAll({
      where: { userType: 'creator', isActive: true },
      order: [['tierLevel', 'ASC']]
    });
    res.json({ success: true, data: tiers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get tiers' });
  }
};

// Get brand tiers
exports.getBrandTiers = async (req, res) => {
  try {
    const tiers = await TierConfiguration.findAll({
      where: { userType: 'brand', isActive: true },
      order: [['tierLevel', 'ASC']]
    });
    res.json({ success: true, data: tiers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get tiers' });
  }
};

// Get platforms
exports.getPlatforms = async (req, res) => {
  res.json({
    success: true,
    data: [
      { value: 'instagram', label: 'Instagram', icon: 'instagram' },
      { value: 'tiktok', label: 'TikTok', icon: 'tiktok' },
      { value: 'youtube', label: 'YouTube', icon: 'youtube' },
      { value: 'twitter', label: 'Twitter/X', icon: 'twitter' },
      { value: 'facebook', label: 'Facebook', icon: 'facebook' },
      { value: 'linkedin', label: 'LinkedIn', icon: 'linkedin' },
      { value: 'other', label: 'Other', icon: 'globe' }
    ]
  });
};

// Get content types
exports.getContentTypes = async (req, res) => {
  res.json({
    success: true,
    data: [
      { value: 'post', label: 'Feed Post', platforms: ['instagram', 'facebook', 'linkedin'] },
      { value: 'story', label: 'Story', platforms: ['instagram', 'facebook'] },
      { value: 'reel', label: 'Reel', platforms: ['instagram', 'facebook'] },
      { value: 'video', label: 'Video', platforms: ['youtube', 'tiktok', 'facebook'] },
      { value: 'short', label: 'Short', platforms: ['youtube'] },
      { value: 'live', label: 'Live Stream', platforms: ['instagram', 'youtube', 'tiktok', 'facebook'] },
      { value: 'tweet', label: 'Tweet', platforms: ['twitter'] },
      { value: 'thread', label: 'Thread', platforms: ['twitter'] },
      { value: 'article', label: 'Article', platforms: ['linkedin'] },
      { value: 'other', label: 'Other', platforms: ['other'] }
    ]
  });
};

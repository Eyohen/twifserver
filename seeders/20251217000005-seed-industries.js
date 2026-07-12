'use strict';
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const industries = [
      { name: 'Fast-Moving Consumer Goods (FMCG)', slug: 'fmcg', description: 'Consumer packaged goods and everyday products' },
      { name: 'Technology', slug: 'technology', description: 'Software, hardware, and tech services' },
      { name: 'Finance & Banking', slug: 'finance-banking', description: 'Financial services, banking, and fintech' },
      { name: 'Healthcare', slug: 'healthcare', description: 'Healthcare, pharmaceuticals, and wellness' },
      { name: 'E-commerce', slug: 'e-commerce', description: 'Online retail and digital marketplaces' },
      { name: 'Entertainment', slug: 'entertainment', description: 'Media, film, music, and entertainment' },
      { name: 'Education', slug: 'education', description: 'Educational institutions and edtech' },
      { name: 'Real Estate', slug: 'real-estate', description: 'Property development and real estate services' },
      { name: 'Telecommunications', slug: 'telecommunications', description: 'Telecom services and mobile networks' },
      { name: 'Hospitality & Tourism', slug: 'hospitality-tourism', description: 'Hotels, restaurants, and travel services' },
      { name: 'Fashion & Apparel', slug: 'fashion-apparel', description: 'Clothing, accessories, and fashion brands' },
      { name: 'Beauty & Personal Care', slug: 'beauty-personal-care', description: 'Cosmetics, skincare, and personal care' },
      { name: 'Food & Beverage', slug: 'food-beverage', description: 'Food products, beverages, and restaurants' },
      { name: 'Automotive', slug: 'automotive', description: 'Automobiles, parts, and automotive services' },
      { name: 'Sports & Fitness', slug: 'sports-fitness', description: 'Sports equipment, gyms, and fitness' },
      { name: 'Agriculture', slug: 'agriculture', description: 'Farming, agribusiness, and food production' },
      { name: 'Energy & Utilities', slug: 'energy-utilities', description: 'Oil, gas, power, and renewable energy' },
      { name: 'Manufacturing', slug: 'manufacturing', description: 'Industrial production and manufacturing' },
      { name: 'Logistics & Transportation', slug: 'logistics-transportation', description: 'Shipping, delivery, and transport' },
      { name: 'Non-Profit & NGO', slug: 'non-profit-ngo', description: 'Charitable organizations and NGOs' },
      { name: 'Government', slug: 'government', description: 'Government agencies and public sector' },
      { name: 'Media & Publishing', slug: 'media-publishing', description: 'News, magazines, and publishing' },
      { name: 'Events & Conferences', slug: 'events-conferences', description: 'Event planning and conference management' },
      { name: 'Insurance', slug: 'insurance', description: 'Insurance products and services' },
      { name: 'Other', slug: 'other', description: 'Other industries not listed' }
    ];

    const industryData = industries.map(i => ({
      id: uuidv4(),
      name: i.name,
      slug: i.slug,
      description: i.description,
      icon: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await queryInterface.bulkInsert('Industries', industryData, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Industries', null, {});
  }
};

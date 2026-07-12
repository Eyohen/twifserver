'use strict';
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const categories = [
      { name: 'Fashion', slug: 'fashion', icon: 'shirt', description: 'Fashion, clothing, and style content' },
      { name: 'Beauty', slug: 'beauty', icon: 'sparkles', description: 'Makeup, skincare, and beauty tutorials' },
      { name: 'Technology', slug: 'technology', icon: 'smartphone', description: 'Tech reviews, gadgets, and software' },
      { name: 'Food & Cooking', slug: 'food-cooking', icon: 'utensils', description: 'Recipes, food reviews, and cooking content' },
      { name: 'Fitness & Health', slug: 'fitness-health', icon: 'dumbbell', description: 'Workout routines, health tips, and wellness' },
      { name: 'Travel', slug: 'travel', icon: 'plane', description: 'Travel vlogs, destination guides, and adventures' },
      { name: 'Entertainment', slug: 'entertainment', icon: 'film', description: 'Movies, music, and pop culture' },
      { name: 'Education', slug: 'education', icon: 'book-open', description: 'Educational content, tutorials, and courses' },
      { name: 'Gaming', slug: 'gaming', icon: 'gamepad-2', description: 'Video game content, reviews, and streaming' },
      { name: 'Lifestyle', slug: 'lifestyle', icon: 'home', description: 'Daily life, home decor, and personal vlogs' },
      { name: 'Business & Finance', slug: 'business-finance', icon: 'briefcase', description: 'Business tips, investment, and finance' },
      { name: 'Parenting', slug: 'parenting', icon: 'baby', description: 'Parenting tips, family content, and kids' },
      { name: 'Sports', slug: 'sports', icon: 'trophy', description: 'Sports content, commentary, and athletics' },
      { name: 'Music', slug: 'music', icon: 'music', description: 'Music creation, covers, and artist content' },
      { name: 'Art & Design', slug: 'art-design', icon: 'palette', description: 'Visual arts, graphic design, and creativity' },
      { name: 'Photography', slug: 'photography', icon: 'camera', description: 'Photography tips, tutorials, and portfolios' },
      { name: 'Comedy', slug: 'comedy', icon: 'laugh', description: 'Comedy skits, jokes, and humor content' },
      { name: 'Automotive', slug: 'automotive', icon: 'car', description: 'Cars, motorcycles, and automotive content' },
      { name: 'Real Estate', slug: 'real-estate', icon: 'building', description: 'Property, real estate, and home buying' },
      { name: 'Pets & Animals', slug: 'pets-animals', icon: 'paw-print', description: 'Pet care, animal content, and wildlife' },
      { name: 'DIY & Crafts', slug: 'diy-crafts', icon: 'scissors', description: 'Do-it-yourself projects and crafts' },
      { name: 'Motivation', slug: 'motivation', icon: 'zap', description: 'Motivational and inspirational content' },
      { name: 'News & Politics', slug: 'news-politics', icon: 'newspaper', description: 'Current events and political commentary' },
      { name: 'Religion & Spirituality', slug: 'religion-spirituality', icon: 'heart', description: 'Religious and spiritual content' },
      { name: 'Science', slug: 'science', icon: 'atom', description: 'Scientific content and discoveries' }
    ];

    const categoryData = categories.map((c, index) => ({
      id: uuidv4(),
      name: c.name,
      slug: c.slug,
      description: c.description,
      icon: c.icon,
      parentId: null,
      displayOrder: index,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await queryInterface.bulkInsert('Categories', categoryData, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Categories', null, {});
  }
};

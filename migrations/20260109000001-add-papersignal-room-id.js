'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add papersignalRoomId column to Conversations table
    await queryInterface.addColumn('Conversations', 'papersignalRoomId', {
      type: Sequelize.STRING(100),
      allowNull: true,
      unique: true
    });

    // Add index for faster lookups
    await queryInterface.addIndex('Conversations', ['papersignalRoomId'], {
      name: 'conversations_papersignal_room_id_idx',
      unique: true,
      where: {
        papersignalRoomId: {
          [Sequelize.Op.ne]: null
        }
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('Conversations', 'conversations_papersignal_room_id_idx');

    // Remove column
    await queryInterface.removeColumn('Conversations', 'papersignalRoomId');
  }
};

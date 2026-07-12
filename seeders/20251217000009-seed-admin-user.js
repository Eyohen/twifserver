'use strict';

const bcrypt = require('bcryptjs');

const adminPermissions = {
  dashboard: { read: true },
  users: { read: true, write: true },
  connections: { read: true },
  opportunities: { read: true },
  bookings: { read: true },
  notifications: { read: true },
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const email = (process.env.ADMIN_EMAIL || 'admin@twif.ng').toLowerCase().trim();
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe@Twif26';
    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date();

    await queryInterface.bulkInsert('Admins', [{
      email,
      password: hashedPassword,
      firstName: process.env.ADMIN_FIRST_NAME || 'Twif',
      lastName: process.env.ADMIN_LAST_NAME || 'Admin',
      role: 'super_admin',
      permissions: JSON.stringify(adminPermissions),
      status: 'active',
      lastLoginAt: null,
      refreshToken: null,
      createdAt: now,
      updatedAt: now,
    }], {
      updateOnDuplicate: [
        'password',
        'firstName',
        'lastName',
        'role',
        'permissions',
        'status',
        'refreshToken',
        'updatedAt',
      ],
    });

    console.log('Seeded Twif admin:', email);
  },

  async down(queryInterface) {
    const email = (process.env.ADMIN_EMAIL || 'admin@twif.ng').toLowerCase().trim();
    await queryInterface.bulkDelete('Admins', { email }, {});
  },
};

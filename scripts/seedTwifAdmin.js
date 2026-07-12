require('dotenv').config();

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../models');

const { Admin } = db;

const buildPassword = () => {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  return `Conn-${crypto.randomBytes(12).toString('base64url')}-26`;
};

const main = async () => {
  const email = (process.env.ADMIN_EMAIL || 'admin@twif.ng').toLowerCase().trim();
  const password = buildPassword();
  const hashedPassword = await bcrypt.hash(password, 12);

  const [admin, created] = await Admin.findOrCreate({
    where: { email },
    defaults: {
      email,
      password: hashedPassword,
      firstName: process.env.ADMIN_FIRST_NAME || 'Twif',
      lastName: process.env.ADMIN_LAST_NAME || 'Admin',
      role: 'super_admin',
      status: 'active',
      permissions: {
        dashboard: { read: true },
        users: { read: true, write: true },
        connections: { read: true },
        opportunities: { read: true },
        bookings: { read: true },
        notifications: { read: true },
      },
    },
  });

  if (!created) {
    await admin.update({
      password: hashedPassword,
      firstName: process.env.ADMIN_FIRST_NAME || admin.firstName || 'Twif',
      lastName: process.env.ADMIN_LAST_NAME || admin.lastName || 'Admin',
      role: 'super_admin',
      status: 'active',
      permissions: {
        dashboard: { read: true },
        users: { read: true, write: true },
        connections: { read: true },
        opportunities: { read: true },
        bookings: { read: true },
        notifications: { read: true },
      },
      refreshToken: null,
    });
  }

  console.log('TWIF_ADMIN_EMAIL=' + email);
  console.log('TWIF_ADMIN_PASSWORD=' + password);
  console.log('TWIF_ADMIN_CREATED=' + created);
};

main()
  .catch((error) => {
    console.error('Failed to seed Twif admin:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.sequelize.close();
  });

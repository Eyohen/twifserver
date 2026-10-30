'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('StaffUsers');
    if (!table.email) {
      await queryInterface.addColumn('StaffUsers', 'email', {
        type: Sequelize.STRING(254),
        allowNull: true,
      });
    }
    await queryInterface.addIndex('StaffUsers', ['email'], {
      name: 'staff_users_email_unique',
      unique: true,
      where: { email: { [Sequelize.Op.ne]: null } },
    });
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "staff_users_single_owner" ON "StaffUsers" ((role)) WHERE role = \'owner\';'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "staff_users_single_owner";');
    await queryInterface.removeIndex('StaffUsers', 'staff_users_email_unique');
    await queryInterface.removeColumn('StaffUsers', 'email');
  },
};

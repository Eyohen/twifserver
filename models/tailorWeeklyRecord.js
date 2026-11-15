'use strict';

// One row per tailor per week, written the first time a week has finished and
// never changed after. It holds what the week came to — the target that was in
// force, the jobs completed, and how that compared — so a later change to the
// target, or to a job, cannot rewrite how an earlier week went.
module.exports = (sequelize, DataTypes) => sequelize.define('TailorWeeklyRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  staffId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // The Monday the week began, as a calendar date.
  weekStart: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  // Null where no target was set for that week.
  target: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  completed: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  // not_met | met | exceeded | no_target
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
}, {
  tableName: 'TailorWeeklyRecords',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['staffId', 'weekStart'] },
  ],
});

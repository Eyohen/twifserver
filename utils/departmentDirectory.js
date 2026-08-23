'use strict';

const db = require('../models');

// The six departments the review doc specifies. A blank Departments table —
// first boot, or a database from before this table existed — gets them back
// automatically, the same way index.js repairs a missing table.
const DEFAULT_DEPARTMENTS = [
  { key: 'suit', name: 'Suit' },
  { key: 'native', name: 'Native' },
  { key: 'shirts', name: 'Shirts' },
  { key: 'agbada', name: 'Agbada' },
  { key: 'design', name: 'Design' },
  { key: 'pants', name: 'Pants' },
];

let cache = new Map(DEFAULT_DEPARTMENTS.map((department) => [department.key, { ...department, status: 'active' }]));

const ensureSeeded = async () => {
  const existing = await db.Department.count();
  if (existing > 0) return;
  await db.Department.bulkCreate(DEFAULT_DEPARTMENTS.map((department) => ({ ...department, status: 'active' })));
};

const refreshDepartmentCache = async () => {
  await ensureSeeded();
  const departments = await db.Department.findAll({ order: [['createdAt', 'ASC']] });
  cache = new Map(departments.map((department) => [department.key, department.get({ plain: true })]));
  return cache;
};

const listDepartments = ({ activeOnly = false } = {}) => [...cache.values()]
  .filter((department) => !activeOnly || department.status === 'active');

const departmentKeys = ({ activeOnly = false } = {}) => listDepartments({ activeOnly }).map((department) => department.key);

module.exports = {
  refreshDepartmentCache,
  listDepartments,
  departmentKeys,
};

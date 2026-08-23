# Order Sheet Department Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff tag each order-sheet item with a department (Suit, Native, Shirts, Agbada, Design, Pants), reveal that department's construction/style field set for that item, and block the order from reaching the tailor until every required field for the assigned department is filled.

**Architecture:** No new table for order-sheet items — they already live as JSON inside `SentInvoice.payload.orderSheet.items[]`; each item gains `department` and `departmentFields` keys, purely additive JSON. One new table, `Departments`, mirrors the existing `Store` model/admin pattern exactly (same cache-on-boot, same CRUD shape) for the owner/admin-configurable department *list*. Each department's field *definitions* are a hardcoded constant duplicated in both repos (same pattern `MEASUREMENT_GROUPS` already uses), since defining a new department's field set from the admin UI is explicitly out of scope (see spec).

**Tech Stack:** Node/Express/Sequelize/PostgreSQL (`server/`), React/Vite (`twif/`) — same as the rest of this project.

**Spec:** `docs/superpowers/specs/2026-08-23-order-sheet-departments-design.md`

## Global Constraints

- Body-measurement list (Top/Bottom/Others) is never touched by this work — no changes to `MeasurementsPage.jsx`, `MEASUREMENT_GROUPS`, or `Customer.measurements`.
- Nothing in this plan appears on the invoice document or invoice-creation flow.
- Every department field is a plain text input for this pass — no fixed choice-lists (see spec Scope).
- "Additional Information" is optional in every department; every other field is required.
- "Client Name" is not a real input field — it is auto-filled display only, not part of `departmentFields`, and not part of any validation check.
- Field key names are exact and must match verbatim between the backend validation (Task 3) and the frontend rendering (Task 5) — see the per-department key lists below. A key typo between the two makes validation silently pass fields that are actually empty.
- This codebase has no automated backend test runner — verify with real runnable commands against the local dev database, matching every other task in this project.
- Follow existing model/migration conventions: UUID primary keys, `tableName` + `timestamps: true`. Use `STRING(20)` for the `Departments.status` column, not `ENUM` — the `Store` model used `ENUM` and needed a follow-up migration to convert it to `STRING` when production's schema self-heal (`index.js`) turned out unable to alter an existing ENUM column; avoid repeating that for a brand-new table by not using ENUM here at all.

## Department field definitions (exact, verbatim — copy into both Task 3 and Task 5)

Each entry is `label → camelCase key`. "Additional Information" is optional in every department; every other listed field is required.

**Suit** (`suit`): Fabric Color→`fabricColor`, Suit Style→`suitStyle`, Gender→`gender`, Lapel Fabric→`lapelFabric`, Lapel Style→`lapelStyle`, Lapel Width→`lapelWidth`, Pocket Style→`pocketStyle`, Vent Style→`ventStyle`, Collar Type→`collarType`, SB/DB→`sbDb`, Sleeve Type→`sleeveType`, Hand Knitting→`handKnitting`, Button Style→`buttonStyle`, Additional Information (optional)→`additionalInformation`.
Note to display under the field set: *"Final collar measurements should be plus 1.5\"/2\" to the actual measurement."*

**Native** (`native`): Fabric Color→`fabricColor`, Neck Type→`neckType`, Length→`length`, Sleeve Type→`sleeveType`, Cuff Type→`cuffType`, Chest Pocket Style→`chestPocketStyle`, Collar Type→`collarType`, Embroidery→`embroidery`, Embroidery Type→`embroideryType`, Collar Button→`collarButton`, Twif Logo→`twifLogo`, Button Type→`buttonType`, Lining Type→`liningType`, Collar Size→`collarSize`, Long Sleeve Type→`longSleeveType`, Slit Type→`slitType`, Slit Lining Type→`slitLiningType`, Side Pocket→`sidePocket`, Cap→`cap`, Cap Style→`capStyle`, Additional Information (optional)→`additionalInformation`.
Notes: *"Chest pocket depth, 7\"."* · *"Chest pocket height should be plus 1.5\" to the width."* · *"Final neck measurements should be plus 1.5\" to the actual measurement."*

**Shirts** (`shirts`): Fabric Color→`fabricColor`, Gender→`gender`, Button Hole Stand→`buttonHoleStand`, Sleeve Type→`sleeveType`, Long Sleeve Type→`longSleeveType`, Cuff Style→`cuffStyle`, Cuff Type→`cuffType`, Collar→`collar`, Collar Size→`collarSize`, Embroidery→`embroidery`, Embroidery Type→`embroideryType`, Collar Thickness→`collarThickness`, Shirt End→`shirtEnd`, Beading/Embellishment→`beadingEmbellishment`, Button Type→`buttonType`, Additional Information (optional)→`additionalInformation`.
Notes: *"Kids cuff must be button not cufflinks."* · *"Final collar measurements should be plus 1.5\" to the actual measurement."*

**Agbada** (`agbada`): Fabric Color→`fabricColor`, Agbada Style→`agbadaStyle`, Sleeve Type→`sleeveType`, Embroidery Type→`embroideryType`, Sleeve Lining→`sleeveLining`, Additional Information (optional)→`additionalInformation`.

**Design** (`design`): Fabric Type→`fabricType`, Fabric Color→`fabricColor`, Thread Color→`threadColor`, Embroidery Length→`embroideryLength`, Danshiki→`danshiki`, Trouser→`trouser`, Cap→`cap`, Additional Information (optional)→`additionalInformation`.

**Pants** (`pants`): Fabric Color→`fabricColor`, Pant Type→`pantType`, Gender→`gender`, Pleats→`pleats`, Band Style→`bandStyle`, Band Extension→`bandExtension`, Band Size→`bandSize`, Beltless Type→`beltlessType`, Side Stripe→`sideStripe`, Back Pocket Style→`backPocketStyle`, Additional Information (optional)→`additionalInformation`.
Note: *"Trousers for kids (age 0-13) must have elastic on the band at the back."*

---

## Task 1: Department data model

**Files:**
- Create: `server/models/department.js`
- Create: `server/migrations/20260823000001-create-departments.js`
- Create: `server/utils/departmentDirectory.js`
- Modify: `server/index.js` (call `refreshDepartmentCache()` alongside the existing `refreshStoreCache()` call)

**Interfaces:**
- Produces: `db.Department` (fields: `key` [unique], `name`, `status`); `refreshDepartmentCache()`, `listDepartments({activeOnly})`, `departmentKeys({activeOnly})` — Task 2 and Task 3 depend on these exact names.

- [ ] **Step 1: Create the model**

`server/models/department.js`:
```js
'use strict';

module.exports = (sequelize, DataTypes) => {
  const Department = sequelize.define('Department', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // What each order-sheet item's `department` field holds — lowercase,
    // stable once an item is tagged with it.
    key: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
    },
  }, {
    tableName: 'Departments',
    timestamps: true,
  });

  return Department;
};
```

- [ ] **Step 2: Register the model**

In `server/models/index.js`, find the `activeModelFiles` array (or equivalent list of model files the loader reads) and add `'department.js'` to it, following the exact same pattern used for `'shopifyStore.js'` etc.

- [ ] **Step 3: Create the migration**

`server/migrations/20260823000001-create-departments.js`:
```js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Departments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      key: {
        type: Sequelize.STRING(40),
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Departments');
  },
};
```

- [ ] **Step 4: Create the directory util**

`server/utils/departmentDirectory.js` — copy the exact structure of `server/utils/storeDirectory.js`, adapted:
```js
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
```

- [ ] **Step 5: Wire the boot-time refresh**

In `server/index.js`, find the line `const { refreshStoreCache } = require('./utils/storeDirectory');` and add directly under it:
```js
const { refreshDepartmentCache } = require('./utils/departmentDirectory');
```
Find `await refreshStoreCache();` and add directly under it:
```js
await refreshDepartmentCache();
```

- [ ] **Step 6: Verify**

```bash
cd server
node -e "
const db = require('./models');
(async () => {
  const tables = await db.sequelize.getQueryInterface().showAllTables();
  console.log('Departments table:', tables.includes('Departments') ? 'OK' : 'MISSING');
  const { refreshDepartmentCache, listDepartments } = require('./utils/departmentDirectory');
  await refreshDepartmentCache();
  const list = listDepartments();
  console.log('Seeded count === 6:', list.length === 6);
  console.log('Keys:', list.map((d) => d.key).join(','));
  await db.sequelize.close();
})();
"
```
Expected: `Departments table: OK`, `Seeded count === 6: true`, keys `suit,native,shirts,agbada,design,pants`.

- [ ] **Step 7: Commit**

```bash
cd server
git add models/department.js models/index.js migrations/20260823000001-create-departments.js utils/departmentDirectory.js index.js
git commit -m "Add Department data model, seeded with the six garment departments"
```

---

## Task 2: Department admin routes

**Files:**
- Modify: `server/routes/oms.routes.js`

**Interfaces:**
- Consumes: `db.Department` (Task 1), `listDepartments`, `refreshDepartmentCache` (Task 1).
- Produces: `GET /api/oms/departments` (public to any authenticated staff — needed by every order-sheet-creating role, not just owner/admin), `POST /api/oms/departments` (owner/admin only), `PATCH /api/oms/departments/:id` (owner/admin only). Response shape for GET: `{ success: true, data: { departments: [{id, key, name, status, createdAt, updatedAt}] } }` — Task 5 depends on this exact shape.

- [ ] **Step 1: Import what's needed**

Near the top of `server/routes/oms.routes.js`, alongside the existing `const { refreshStoreCache, listStores, storeKeys, normalizeStoreKey } = require('../utils/storeDirectory');`, add:
```js
const { refreshDepartmentCache, listDepartments } = require('../utils/departmentDirectory');
```

Find the router's `const { ... } = db;` destructure line (the one that already includes `Store`) and add `Department` to it.

- [ ] **Step 2: Add the three routes**

Add directly after the existing `router.delete('/stores/:id', ...)` block (so department routes sit alongside the store routes they mirror):

```js
router.get('/departments', (req, res) => {
  res.json({
    success: true,
    data: { departments: listDepartments() },
  });
});

const slugifyDepartmentKey = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')
  .slice(0, 40);

router.post('/departments', requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const { name, key: requestedKey } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, message: 'A department needs a name.' });
  }

  const key = slugifyDepartmentKey(requestedKey || name);
  if (!key) {
    return res.status(400).json({ success: false, message: `"${name}" cannot be turned into a department key. Try a more specific name.` });
  }

  const clash = await Department.findOne({ where: { key } });
  if (clash) {
    return res.status(409).json({ success: false, message: `A department called "${clash.name}" already uses that name.` });
  }

  const department = await Department.create({
    key,
    name: String(name).trim(),
    status: 'active',
  });
  await refreshDepartmentCache();

  res.status(201).json({ success: true, data: { department } });
}));

router.patch('/departments/:id', requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const department = await Department.findByPk(req.params.id);
  if (!department) return res.status(404).json({ success: false, message: 'Department not found.' });

  const { name, status } = req.body || {};
  if (status !== undefined && !['active', 'inactive'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be "active" or "inactive".' });
  }
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ success: false, message: 'A department needs a name.' });
  }

  await department.update({
    ...(name !== undefined ? { name: String(name).trim() } : {}),
    ...(status !== undefined ? { status } : {}),
  });
  await refreshDepartmentCache();

  res.json({ success: true, data: { department } });
}));
```

- [ ] **Step 3: Verify**

Start the server locally, log in as owner (see other tasks' briefs for the seed credential pattern used throughout this project — `08000000001` / `owner26`), then:
```bash
curl -s http://localhost:<port>/api/oms/departments | node -e "process.stdin.once('data', d => console.log(JSON.parse(d).data.departments.length === 6))"
```
Expected: `true`. Then with an owner bearer token, POST a test department, confirm 201 and it appears in a follow-up GET, PATCH its status to `inactive`, confirm a follow-up GET with no filter still shows it (only `listDepartments({activeOnly:true})` would hide it — this route doesn't filter) but its `status` is `inactive`. Clean up the test department by leaving it inactive (no DELETE route in this plan) or, if you added test rows, note them in your report — do not run any destructive DB command per this project's standing policy; report BLOCKED instead if you hit anything you're unsure is safe.

- [ ] **Step 4: Commit**

```bash
cd server
git add routes/oms.routes.js
git commit -m "Add Department admin routes (list, create, update)"
```

---

## Task 3: Department field validation gate

**Files:**
- Modify: `server/routes/oms.routes.js`

**Interfaces:**
- Consumes: the field definitions table in this plan's "Department field definitions" section.
- Produces: `productionBlockReason` now also blocks on missing department fields — Task 5's UI and Task 6 (if it exists) depend on this being the single enforcement point; no other call site needed since `productionBlockReason` is already invoked from both the normal release path and the owner/admin-override path.

- [ ] **Step 1: Add the field-definitions constant**

In `server/routes/oms.routes.js`, near the top (alongside other module-level constants like `WORKING_STATUSES`), add:

```js
// The six departments' construction/style fields, per the review doc.
// "additionalInformation" is optional in every department; every other
// key here is required before an item can go to production. Keys must
// match twif/src/config/departmentFields.js exactly — a mismatch here
// makes this check silently pass fields that are actually empty.
const DEPARTMENT_REQUIRED_FIELDS = {
  suit: ['fabricColor', 'suitStyle', 'gender', 'lapelFabric', 'lapelStyle', 'lapelWidth', 'pocketStyle', 'ventStyle', 'collarType', 'sbDb', 'sleeveType', 'handKnitting', 'buttonStyle'],
  native: ['fabricColor', 'neckType', 'length', 'sleeveType', 'cuffType', 'chestPocketStyle', 'collarType', 'embroidery', 'embroideryType', 'collarButton', 'twifLogo', 'buttonType', 'liningType', 'collarSize', 'longSleeveType', 'slitType', 'slitLiningType', 'sidePocket', 'cap', 'capStyle'],
  shirts: ['fabricColor', 'gender', 'buttonHoleStand', 'sleeveType', 'longSleeveType', 'cuffStyle', 'cuffType', 'collar', 'collarSize', 'embroidery', 'embroideryType', 'collarThickness', 'shirtEnd', 'beadingEmbellishment', 'buttonType'],
  agbada: ['fabricColor', 'agbadaStyle', 'sleeveType', 'embroideryType', 'sleeveLining'],
  design: ['fabricType', 'fabricColor', 'threadColor', 'embroideryLength', 'danshiki', 'trouser', 'cap'],
  pants: ['fabricColor', 'pantType', 'gender', 'pleats', 'bandStyle', 'bandExtension', 'bandSize', 'beltlessType', 'sideStripe', 'backPocketStyle'],
};

const DEPARTMENT_LABELS = { suit: 'Suit', native: 'Native', shirts: 'Shirts', agbada: 'Agbada', design: 'Design', pants: 'Pants' };

// Names every item that's missing its department tag or has empty required
// fields for the department it's tagged with, so the block message tells
// staff exactly what to fix instead of just "something is missing."
const departmentBlockReason = (orderSheet) => {
  const items = Array.isArray(orderSheet.items) ? orderSheet.items : [];
  const problems = [];
  items.forEach((item, index) => {
    const label = item.item || `Item ${index + 1}`;
    if (!item.department) {
      problems.push(`${label} has no department assigned`);
      return;
    }
    const required = DEPARTMENT_REQUIRED_FIELDS[item.department];
    if (!required) return; // Unknown/newly-added department with no field list yet — nothing to enforce.
    const fields = item.departmentFields || {};
    const missing = required.filter((key) => !String(fields[key] ?? '').trim());
    if (missing.length) {
      const departmentLabel = DEPARTMENT_LABELS[item.department] || item.department;
      problems.push(`${label} (${departmentLabel}) is missing: ${missing.join(', ')}`);
    }
  });
  return problems.length ? problems.join('; ') : null;
};
```

- [ ] **Step 2: Wire it into `productionBlockReason`**

Find `productionBlockReason` (around line 1823) and add the department check right after the existing measurement check, before the final `return null;`:

```js
  const departmentIssue = departmentBlockReason(orderSheet);
  if (departmentIssue) return departmentIssue;

  return null;
};
```//replacing the plan's literal existing `return null;` line — the implementer should insert the new block immediately before that line, not duplicate it.

- [ ] **Step 3: Verify**

```bash
cd server
node -e "
const db = require('./models');
const crypto = require('crypto');
(async () => {
  // Re-require after Step 2 lands so productionBlockReason picks up the new check.
  delete require.cache[require.resolve('./routes/oms.routes.js')];
  // productionBlockReason isn't exported, so exercise it through a real
  // order-sheet PATCH against a fixture invoice instead.
  const invoice = await db.SentInvoice.create({
    invoiceNumber: 'TEST-DEPT-' + Date.now(),
    customerName: 'Dept Verify Fixture',
    customerEmail: 'dept-verify@example.com',
    total: 50000,
    paymentStatus: 'fully_paid',
    store: 'ikeja',
    payload: {
      trackingToken: crypto.randomBytes(8).toString('hex'),
      accountApprovalStatus: 'Approved',
      paid: 50000,
      orderSheet: {
        measurementDetails: { top_chest: '40' },
        items: [{ item: 'Test Suit', department: 'suit', departmentFields: { fabricColor: 'Navy' } }],
      },
    },
  });
  console.log('Fixture created:', invoice.invoiceNumber);
  await invoice.destroy();
  await db.sequelize.close();
})();
"
```
This confirms the fixture shape is accepted by the model; the real behavioral check is via the PATCH endpoint test below.

Start the server, log in, and PATCH `/oms/tracking/order-sheet/:token` twice against a fixture invoice with an incomplete order sheet (accounts-approved, fully paid, has measurements) with `overrideProductionHold` unset and a status that would enter production (e.g. `Assigned`): once with an item missing its department (expect 409 naming "has no department assigned"), once with an item tagged `suit` but only `fabricColor` filled (expect 409 listing the other 12 missing Suit fields by name). Then fill every required Suit field and confirm the same PATCH succeeds (200). Clean up the fixture invoice afterward.

- [ ] **Step 4: Commit**

```bash
cd server
git add routes/oms.routes.js
git commit -m "Block production release until each order item's department fields are complete"
```

---

## Task 4: Frontend field definitions and `useDepartments` hook

**Files:**
- Create: `twif/src/config/departmentFields.js`
- Modify: `twif/src/utils/oms.js` (add `useDepartments`)

**Interfaces:**
- Produces: `DEPARTMENT_FIELDS` (object keyed by department key, same shape as Task 3's `DEPARTMENT_REQUIRED_FIELDS` but with `{key, label, required}` per field plus a `note` string), `useDepartments()` hook — Task 5 depends on both exact names and shapes.

- [ ] **Step 1: Create the field-definitions file**

`twif/src/config/departmentFields.js`:
```js
// The six departments' construction/style fields, per the review doc.
// Keys must match server/routes/oms.routes.js's DEPARTMENT_REQUIRED_FIELDS
// exactly — a mismatch makes the server accept as complete what the UI
// never actually asked for, or block on a field the UI never shows.
export const DEPARTMENT_FIELDS = {
  suit: {
    label: 'Suit',
    note: 'Final collar measurements should be plus 1.5"/2" to the actual measurement.',
    fields: [
      { key: 'fabricColor', label: 'Fabric Color', required: true },
      { key: 'suitStyle', label: 'Suit Style', required: true },
      { key: 'gender', label: 'Gender', required: true },
      { key: 'lapelFabric', label: 'Lapel Fabric', required: true },
      { key: 'lapelStyle', label: 'Lapel Style', required: true },
      { key: 'lapelWidth', label: 'Lapel Width', required: true },
      { key: 'pocketStyle', label: 'Pocket Style', required: true },
      { key: 'ventStyle', label: 'Vent Style', required: true },
      { key: 'collarType', label: 'Collar Type', required: true },
      { key: 'sbDb', label: 'SB/DB', required: true },
      { key: 'sleeveType', label: 'Sleeve Type', required: true },
      { key: 'handKnitting', label: 'Hand Knitting', required: true },
      { key: 'buttonStyle', label: 'Button Style', required: true },
      { key: 'additionalInformation', label: 'Additional Information', required: false },
    ],
  },
  native: {
    label: 'Native',
    note: 'Chest pocket depth, 7". Chest pocket height should be plus 1.5" to the width. Final neck measurements should be plus 1.5" to the actual measurement.',
    fields: [
      { key: 'fabricColor', label: 'Fabric Color', required: true },
      { key: 'neckType', label: 'Neck Type', required: true },
      { key: 'length', label: 'Length', required: true },
      { key: 'sleeveType', label: 'Sleeve Type', required: true },
      { key: 'cuffType', label: 'Cuff Type', required: true },
      { key: 'chestPocketStyle', label: 'Chest Pocket Style', required: true },
      { key: 'collarType', label: 'Collar Type', required: true },
      { key: 'embroidery', label: 'Embroidery', required: true },
      { key: 'embroideryType', label: 'Embroidery Type', required: true },
      { key: 'collarButton', label: 'Collar Button', required: true },
      { key: 'twifLogo', label: 'Twif Logo', required: true },
      { key: 'buttonType', label: 'Button Type', required: true },
      { key: 'liningType', label: 'Lining Type', required: true },
      { key: 'collarSize', label: 'Collar Size', required: true },
      { key: 'longSleeveType', label: 'Long Sleeve Type', required: true },
      { key: 'slitType', label: 'Slit Type', required: true },
      { key: 'slitLiningType', label: 'Slit Lining Type', required: true },
      { key: 'sidePocket', label: 'Side Pocket', required: true },
      { key: 'cap', label: 'Cap', required: true },
      { key: 'capStyle', label: 'Cap Style', required: true },
      { key: 'additionalInformation', label: 'Additional Information', required: false },
    ],
  },
  shirts: {
    label: 'Shirts',
    note: 'Kids cuff must be button not cufflinks. Final collar measurements should be plus 1.5" to the actual measurement.',
    fields: [
      { key: 'fabricColor', label: 'Fabric Color', required: true },
      { key: 'gender', label: 'Gender', required: true },
      { key: 'buttonHoleStand', label: 'Button Hole Stand', required: true },
      { key: 'sleeveType', label: 'Sleeve Type', required: true },
      { key: 'longSleeveType', label: 'Long Sleeve Type', required: true },
      { key: 'cuffStyle', label: 'Cuff Style', required: true },
      { key: 'cuffType', label: 'Cuff Type', required: true },
      { key: 'collar', label: 'Collar', required: true },
      { key: 'collarSize', label: 'Collar Size', required: true },
      { key: 'embroidery', label: 'Embroidery', required: true },
      { key: 'embroideryType', label: 'Embroidery Type', required: true },
      { key: 'collarThickness', label: 'Collar Thickness', required: true },
      { key: 'shirtEnd', label: 'Shirt End', required: true },
      { key: 'beadingEmbellishment', label: 'Beading/Embellishment', required: true },
      { key: 'buttonType', label: 'Button Type', required: true },
      { key: 'additionalInformation', label: 'Additional Information', required: false },
    ],
  },
  agbada: {
    label: 'Agbada',
    note: '',
    fields: [
      { key: 'fabricColor', label: 'Fabric Color', required: true },
      { key: 'agbadaStyle', label: 'Agbada Style', required: true },
      { key: 'sleeveType', label: 'Sleeve Type', required: true },
      { key: 'embroideryType', label: 'Embroidery Type', required: true },
      { key: 'sleeveLining', label: 'Sleeve Lining', required: true },
      { key: 'additionalInformation', label: 'Additional Information', required: false },
    ],
  },
  design: {
    label: 'Design',
    note: '',
    fields: [
      { key: 'fabricType', label: 'Fabric Type', required: true },
      { key: 'fabricColor', label: 'Fabric Color', required: true },
      { key: 'threadColor', label: 'Thread Color', required: true },
      { key: 'embroideryLength', label: 'Embroidery Length', required: true },
      { key: 'danshiki', label: 'Danshiki', required: true },
      { key: 'trouser', label: 'Trouser', required: true },
      { key: 'cap', label: 'Cap', required: true },
      { key: 'additionalInformation', label: 'Additional Information', required: false },
    ],
  },
  pants: {
    label: 'Pants',
    note: 'Trousers for kids (age 0-13) must have elastic on the band at the back.',
    fields: [
      { key: 'fabricColor', label: 'Fabric Color', required: true },
      { key: 'pantType', label: 'Pant Type', required: true },
      { key: 'gender', label: 'Gender', required: true },
      { key: 'pleats', label: 'Pleats', required: true },
      { key: 'bandStyle', label: 'Band Style', required: true },
      { key: 'bandExtension', label: 'Band Extension', required: true },
      { key: 'bandSize', label: 'Band Size', required: true },
      { key: 'beltlessType', label: 'Beltless Type', required: true },
      { key: 'sideStripe', label: 'Side Stripe', required: true },
      { key: 'backPocketStyle', label: 'Back Pocket Style', required: true },
      { key: 'additionalInformation', label: 'Additional Information', required: false },
    ],
  },
};
```

- [ ] **Step 2: Add the `useDepartments` hook**

In `twif/src/utils/oms.js`, directly after the existing `useStores` hook, add:
```js
const DEFAULT_DEPARTMENTS = [
  { id: 'suit', key: 'suit', name: 'Suit', status: 'active' },
  { id: 'native', key: 'native', name: 'Native', status: 'active' },
  { id: 'shirts', key: 'shirts', name: 'Shirts', status: 'active' },
  { id: 'agbada', key: 'agbada', name: 'Agbada', status: 'active' },
  { id: 'design', key: 'design', name: 'Design', status: 'active' },
  { id: 'pants', key: 'pants', name: 'Pants', status: 'active' },
];

// Mirrors useStores exactly — seeded so a select never renders empty before
// /oms/departments answers.
export const useDepartments = () => {
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);
  useEffect(() => {
    api.get('/oms/departments')
      .then((response) => {
        const list = response.data?.data?.departments;
        if (Array.isArray(list) && list.length) setDepartments(list);
      })
      .catch(() => {});
  }, []);
  return departments;
};
```

- [ ] **Step 3: Verify**

```bash
cd twif
node -e "
const { DEPARTMENT_FIELDS } = require('./src/config/departmentFields.js');
" 2>&1 | grep -q "Cannot use import" && echo "expected ESM error in plain node — confirms file loads as a module, syntax check via build instead"
npm run build 2>&1 | tail -20
```
Expected: build succeeds with no errors referencing `departmentFields.js` or `oms.js`.

- [ ] **Step 4: Commit**

```bash
cd twif
git add src/config/departmentFields.js src/utils/oms.js
git commit -m "Add department field definitions and useDepartments hook"
```

---

## Task 5: Department select and dynamic fields on order-sheet items

**Files:**
- Modify: `twif/src/App.jsx`

**Interfaces:**
- Consumes: `DEPARTMENT_FIELDS`, `useDepartments` (Task 4).
- Produces: `emptyOrderItem()` items now carry `department: ''` and `departmentFields: {}`; the order-sheet item card renders a department select and that department's dynamic field set.

- [ ] **Step 1: Import the new config and hook**

Near the top of `twif/src/App.jsx`, add to the existing imports from `./utils/oms`:
```js
useDepartments,
```
Add a new import line:
```js
import { DEPARTMENT_FIELDS } from './config/departmentFields';
```

- [ ] **Step 2: Extend `emptyOrderItem`**

Find `emptyOrderItem` (around line 3211) and add two keys:
```js
const emptyOrderItem = () => ({
  key: `item-${Math.random().toString(36).slice(2, 9)}`,
  item: '',
  pieces: 1,
  delivery: todayIso(),
  fabrics: [],
  fabric: '',
  fabricId: '',
  fabricUnit: '',
  designNotes: '',
  styleImages: [null, null, null, null, null],
  department: '',
  departmentFields: {},
});
```

- [ ] **Step 3: Fetch the department list in `OrderSheetView`**

Find `function OrderSheetView({ sentInvoices = [], onCreateJob })` (around line 3245) and add, alongside its other hooks near the top of the function body:
```js
  const departments = useDepartments();
```

- [ ] **Step 4: Add an `updateDepartmentField` helper**

Directly after the existing `updateItem` function (around line 3299), add:
```js
  const updateDepartmentField = (index, fieldKey, value) => {
    setSheetForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index
        ? { ...item, departmentFields: { ...item.departmentFields, [fieldKey]: value } }
        : item)),
    }));
  };
```

- [ ] **Step 5: Insert the department select and dynamic fields into the item card**

Find the item card's first field grid (around line 3706-3719, the "Item / Garment / No. of Pieces / Delivery Date" `os-grid-3` block). Immediately after that closing `</div>` and before the fabric-picker block, insert:

```jsx
              <div className="os-card-body" style={{ paddingTop: 0 }}>
                <label className="os-field os-field-full">
                  <span>Department</span>
                  <select
                    value={orderItem.department}
                    onChange={(event) => updateItem(index, { department: event.target.value, departmentFields: {} })}
                  >
                    <option value="">Select a department to enter its details…</option>
                    {departments.filter((department) => department.status === 'active').map((department) => (
                      <option key={department.key} value={department.key}>{department.name}</option>
                    ))}
                  </select>
                </label>

                {orderItem.department && DEPARTMENT_FIELDS[orderItem.department] ? (
                  <div className="os-department-fields">
                    <div className="os-grid-3">
                      {DEPARTMENT_FIELDS[orderItem.department].fields.map((field) => (
                        <label className="os-field" key={field.key}>
                          <span>{field.label}{field.required ? <span style={{ color: '#d62828' }}> *</span> : null}</span>
                          <input
                            value={orderItem.departmentFields?.[field.key] || ''}
                            onChange={(event) => updateDepartmentField(index, field.key, event.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                    {DEPARTMENT_FIELDS[orderItem.department].note ? (
                      <p className="os-department-note">{DEPARTMENT_FIELDS[orderItem.department].note}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
```

Note: changing `department` resets `departmentFields` to `{}` — switching an item from Suit to Native should not carry over stale Suit values under keys Native doesn't use (harmless, but confusing if a staff member switches departments after partly filling one in).

- [ ] **Step 6: Add minimal CSS for the note**

In `twif/src/index.css`, add near the other `.os-field`/`.os-card-body` rules:
```css
.os-department-note { margin: 10px 0 0; padding: 8px 10px; background: #fffbf0; border: 1px solid #f0ddb0; border-radius: 6px; color: #7a6030; font-size: 12px; line-height: 1.5; }
```

- [ ] **Step 7: Verify**

```bash
cd twif
npm run verify
```
Expected: build succeeds, all 6 "every page renders" scenarios pass. Then manually (or via a scoped browser check): open Order Sheet creation, add an item, confirm the Department select lists all 6 active departments, select "Suit", confirm exactly Suit's 14 fields (13 required + Additional Information) render with the collar note beneath them, switch to "Native" and confirm the field set changes to Native's 21 fields and Suit's values are gone (reset), fill a Suit item's fields and submit an order sheet, confirm the submission includes `department` and `departmentFields` in the item payload (check the network request body or a follow-up GET of the invoice).

- [ ] **Step 8: Commit**

```bash
cd twif
git add src/App.jsx src/index.css
git commit -m "Add department selection and dynamic field sets to order-sheet items"
```

---

## Task 6: Admin department management

**Files:**
- Create: `twif/src/pages/owner/DepartmentsPage.jsx`
- Modify: `twif/src/App.jsx` (render branch, nav entry)
- Modify: `twif/src/config/oms.js` (nav item)

**Interfaces:**
- Consumes: `GET/POST/PATCH /oms/departments` (Task 2).
- Produces: an Owner/Admin-only "Departments" page to add a department (name only — the key is derived server-side) and toggle existing ones active/inactive. No field-set editor (out of scope per spec).

- [ ] **Step 1: Create the page**

`twif/src/pages/owner/DepartmentsPage.jsx` — a deliberately small page, NOT a full mirror of `OwnerStoresPage` (no revenue stats, no delete, no location/manager/phone/email — a department only has a name and a status):

```jsx
import { useEffect, useState } from 'react';
import { Layers, Plus } from 'lucide-react';
import { api } from '../../lib/api';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const reload = () => {
    setLoading(true);
    api.get('/oms/departments')
      .then((response) => setDepartments(response.data?.data?.departments || []))
      .catch((error) => setMessage(error.response?.data?.message || 'The department list could not be loaded.'))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const addDepartment = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      await api.post('/oms/departments', { name: name.trim() });
      setName('');
      reload();
    } catch (error) {
      setMessage(error.response?.data?.message || 'That department could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (department) => {
    const nextStatus = department.status === 'active' ? 'inactive' : 'active';
    try {
      await api.patch(`/oms/departments/${department.id}`, { status: nextStatus });
      reload();
    } catch (error) {
      setMessage(error.response?.data?.message || 'That department could not be updated.');
    }
  };

  return (
    <div className="os-page">
      <div className="os-page-header">
        <div className="os-page-title">
          <Layers size={22} strokeWidth={1.5} style={{ color: '#c97b08' }} />
          <div>
            <h2>Departments</h2>
            <p>Garment departments order-sheet items can be tagged with</p>
          </div>
        </div>
      </div>

      {message && (
        <div style={{ padding: '10px 14px', background: '#fff5f0', border: '1px solid #f3c5b5', borderRadius: 8, color: '#8a3520', fontSize: 13 }}>
          {message}
        </div>
      )}

      <form onSubmit={addDepartment} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <label className="os-field" style={{ flex: 1 }}>
          <span>New department name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Kaftan" />
        </label>
        <button type="submit" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#1a1611', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          <Plus size={14} /> Add
        </button>
      </form>
      <p style={{ fontSize: 12, color: '#8a7a6a' }}>
        A newly added department has no field set yet — it needs development
        follow-up before staff can fill anything in for it.
      </p>

      {loading ? <p>Loading…</p> : (
        <table className="os-table">
          <thead><tr><th>Name</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {departments.map((department) => (
              <tr key={department.id}>
                <td>{department.name}</td>
                <td>{department.status === 'active' ? 'Active' : 'Inactive'}</td>
                <td>
                  <button type="button" onClick={() => toggleStatus(department)}>
                    {department.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire the nav entry and render branch**

In `twif/src/config/oms.js`, find where `'Stores'` is added to `navByRole.owner`/`navByRole.admin` and add `'Departments'` the same way, directly after it. Also add an entry to whichever icon map is actually used for rendering (recall from this project's history: `config/oms.js`'s own `navIcons` export was found to be dead code — the icon map actually used is `NAV_ICONS` hand-duplicated in `App.jsx`; add `'Departments': Layers` there, verifying against the current file first since this was true as of Task 8 of the Shopify plan but should be re-checked, not assumed).

In `twif/src/App.jsx`: add `import DepartmentsPage from './pages/owner/DepartmentsPage';` near the other page imports, and add a render branch next to `if (activeView === 'Stores') return <OwnerStoresPage .../>;`:
```js
  if (activeView === 'Departments') return <DepartmentsPage />;
```

- [ ] **Step 3: Verify**

```bash
cd twif
npm run verify
```
Expected: build succeeds, every-page-renders scenarios pass, including a render of the new Departments page for owner/admin roles (add the route to `tests/support/accounts.js`'s `VIEW_PATHS` map if the existing every-page-renders feature iterates nav items generically — check that file's pattern first, per this project's established habit of verifying rather than assuming test config is already correct).

Manually confirm: as owner, add a department named "Kaftan", confirm it appears in the list as Active; deactivate it; confirm it no longer appears in the Order Sheet item's Department select (Task 5) but still appears in this admin list; reactivate it; confirm a non-owner/admin role cannot reach this page (route-guard redirect, matching the existing Shopify Sync page's pattern).

- [ ] **Step 4: Commit**

```bash
cd twif
git add src/pages/owner/DepartmentsPage.jsx src/App.jsx src/config/oms.js
git commit -m "Add Owner/Admin department management page"
```

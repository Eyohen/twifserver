'use strict';

// Weekly production targets for tailors.
//
// A week runs Monday to Sunday in West Africa Time (UTC+1, which has no daylight
// saving), so "this week" is the same week for everyone in the shop whatever
// clock the server runs on.
//
// A job counts toward a tailor's week by the day Production marked it ready, and
// toward every tailor who was on it. Nothing carries from one week to the next:
// each week is a count of its own jobs against the target in force for it.

const WAT_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const FINISHED_STATES = ['Ready', 'Ready for Collection', 'Completed'];

// The Monday (as YYYY-MM-DD) of the week an instant falls in.
const weekStartOf = (instant = new Date()) => {
  const shifted = new Date(new Date(instant).getTime() + WAT_OFFSET_MS);
  const sinceMonday = (shifted.getUTCDay() + 6) % 7;
  shifted.setUTCHours(0, 0, 0, 0);
  shifted.setUTCDate(shifted.getUTCDate() - sinceMonday);
  return shifted.toISOString().slice(0, 10);
};

const weekBounds = (weekStart) => {
  const [year, month, day] = weekStart.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - WAT_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS - 1) };
};

const addWeeks = (weekStart, weeks) => {
  const [year, month, day] = weekStart.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + weeks * 7)).toISOString().slice(0, 10);
};

// Completed against target, never capped: 8 done on a target of 5 is 8/5.
const statusFor = (target, completed) => {
  if (target === null || target === undefined) return 'no_target';
  if (completed > target) return 'exceeded';
  if (completed === target) return 'met';
  return 'not_met';
};

// The target a week was judged against: the last one in force by the end of
// that week. A change made during the week applies to it; a change made after
// it has ended leaves it alone.
const targetForWeek = (staff, weekEnd) => {
  const history = Array.isArray(staff.weeklyTargetHistory) ? [...staff.weeklyTargetHistory] : [];
  // A target set before changes were recorded takes effect from the account's start.
  if (!history.length && staff.weeklyTarget) history.push({ target: staff.weeklyTarget, effectiveFrom: new Date(staff.createdAt || 0).toISOString() });
  const inForce = history
    .filter((entry) => entry?.effectiveFrom && new Date(entry.effectiveFrom) <= weekEnd)
    .sort((a, b) => new Date(a.effectiveFrom) - new Date(b.effectiveFrom))
    .pop();
  return inForce && Number.isFinite(Number(inForce.target)) && Number(inForce.target) > 0 ? Number(inForce.target) : null;
};

// Sheets that were finished before the finishing day was kept are given the last
// date they changed, once; from then on it does not move.
const ensureReadyDates = async (db) => {
  const { SentInvoice, sequelize } = db;
  const states = FINISHED_STATES.map((state) => `'${state}'`).join(',');
  const unstamped = await SentInvoice.findAll({
    where: {
      [db.Sequelize.Op.and]: [
        sequelize.literal(`("SentInvoice"."payload"->'orderSheet'->>'status') IN (${states})`),
        sequelize.literal(`("SentInvoice"."payload"->'orderSheet'->>'readyAt') IS NULL`),
      ],
    },
  });
  for (const row of unstamped) {
    const sheet = row.payload.orderSheet;
    const when = sheet.updatedAt || (row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString());
    await row.update({ payload: { ...row.payload, orderSheet: { ...sheet, readyAt: when } } });
  }
};

// Every finished job since a date, reduced to when it was finished and who was on
// it. Read with the fields picked out in the database, so the style photographs
// and receipts kept on an order are not pulled across to count it.
const finishedJobsSince = async (db, since) => {
  const [rows] = await db.sequelize.query(
    `SELECT "invoiceNumber",
            ("payload"->'orderSheet'->>'readyAt') AS "readyAt",
            ("payload"->'orderSheet'->>'tailor') AS "sheetTailor",
            ("payload"->'orderSheet'->'tailors') AS "sheetTailors",
            (SELECT COALESCE(jsonb_agg(item->'tailors'), '[]'::jsonb)
               FROM jsonb_array_elements(CASE WHEN jsonb_typeof("payload"->'orderSheet'->'items') = 'array'
                                              THEN "payload"->'orderSheet'->'items' ELSE '[]'::jsonb END) AS item) AS "itemTailors"
       FROM "SentInvoices"
      WHERE ("payload"->'orderSheet'->>'status') IN (:states)
        AND ("payload"->>'archivedAt') IS NULL
        AND ("payload"->'orderSheet'->>'archivedAt') IS NULL
        AND ("payload"->'orderSheet'->>'readyAt')::timestamptz >= :since`,
    { replacements: { states: FINISHED_STATES, since } }
  );
  return rows.map((row) => {
    const names = new Set();
    (Array.isArray(row.itemTailors) ? row.itemTailors : []).forEach((list) => {
      if (Array.isArray(list)) list.forEach((name) => name && names.add(String(name)));
    });
    if (Array.isArray(row.sheetTailors)) row.sheetTailors.forEach((name) => name && names.add(String(name)));
    if (row.sheetTailor && row.sheetTailor !== 'Unassigned') names.add(String(row.sheetTailor));
    return { invoiceNumber: row.invoiceNumber, readyAt: new Date(row.readyAt), tailors: names };
  });
};

const completedIn = (jobs, tailorName, bounds) => jobs
  .filter((job) => job.tailors.has(tailorName) && job.readyAt >= bounds.start && job.readyAt <= bounds.end)
  .length;

// What one tailor's week came to. A week that has ended is read from the stored
// record if there is one, and written once if not; the current week is always
// worked out afresh, since it is still going.
const weekFigures = async (db, staff, weekStart, jobs, now = new Date(), stored = null) => {
  const bounds = weekBounds(weekStart);
  const closed = bounds.end < now;
  if (closed && stored) {
    return { weekStart, weekEnd: bounds.end.toISOString(), target: stored.target, completed: stored.completed, status: stored.status, closed: true };
  }
  const target = targetForWeek(staff, bounds.end);
  const completed = completedIn(jobs, staff.displayName, bounds);
  const status = statusFor(target, completed);
  if (closed) {
    // Written once and never updated: the week has ended.
    await db.TailorWeeklyRecord.findOrCreate({
      where: { staffId: staff.id, weekStart },
      defaults: { target, completed, status },
    });
  }
  return { weekStart, weekEnd: bounds.end.toISOString(), target, completed, status, closed };
};

// Results worth a manager's eye. They are only ever shown, never acted on: any
// bonus or deduction is for management to decide.
const reviewFlag = (closedWeeks) => {
  const recent = closedWeeks.filter((week) => week.target !== null);
  if (recent[0]?.status === 'exceeded') {
    return { type: 'bonus_review', text: 'Exceeded the target last week. Management may wish to consider a bonus.' };
  }
  const streak = [];
  for (const week of recent) {
    if (week.status !== 'not_met') break;
    streak.push(week);
  }
  if (streak.length >= 3) {
    return { type: 'performance_review', text: `Target not met ${streak.length} weeks running. Management may wish to review.` };
  }
  return null;
};

module.exports = {
  FINISHED_STATES,
  weekStartOf,
  weekBounds,
  addWeeks,
  statusFor,
  targetForWeek,
  ensureReadyDates,
  finishedJobsSince,
  completedIn,
  weekFigures,
  reviewFlag,
};

'use strict';

const crypto = require('crypto');
const { Client } = require('pg');

const apply = process.argv.includes('--apply');
const clean = (value) => String(value ?? '').trim();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => {
  const candidate = clean(value).toLowerCase();
  return emailPattern.test(candidate) ? candidate : null;
};

const normalizePhone = (value) => {
  let raw = clean(value);
  if (!raw) return null;
  if (/^\d+(?:\.\d+)?e[+-]?\d+$/i.test(raw)) raw = String(Math.trunc(Number(raw)));
  const groups = raw.match(/\d+/g) || [];
  for (const group of groups) {
    if (/^0\d{10}$/.test(group)) return group;
    if (/^234\d{10}$/.test(group)) return `0${group.slice(3)}`;
    if (/^[789]\d{9}$/.test(group)) return `0${group}`;
  }
  const digits = groups.join('');
  const firstEleven = digits.match(/0\d{10}/)?.[0];
  return firstEleven || null;
};

const excelDate = (value) => {
  const serial = Number(value);
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const date = new Date((serial - 25569) * 86400 * 1000);
  return Number.isNaN(date.valueOf()) ? null : date;
};

const sourceId = (row, index) => {
  const value = clean(row.E || row.A);
  if (!value) return `row-${index + 2}`;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(Math.trunc(numeric)) : value;
};

const mergeText = (current, incoming) => {
  const first = clean(current);
  const second = clean(incoming);
  if (!second || first.includes(second)) return first;
  return first ? `${first}\n\n${second}` : second;
};

const main = async () => {
  const input = await new Promise((resolve, reject) => {
    let body = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { body += chunk; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
    });
    process.stdin.on('error', reject);
  });
  if (!Array.isArray(input)) throw new Error('Expected a JSON array on stdin');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('BEGIN');

  try {
    const existingResult = await client.query('SELECT id, "fullName", phone, email, category, measurements, "createdAt" FROM "Customers"');
    const records = existingResult.rows.map((row) => ({ ...row, measurements: row.measurements || {}, existing: true }));
    const byPhone = new Map();
    const byEmail = new Map();
    const bySource = new Map();
    for (const record of records) {
      const phone = normalizePhone(record.phone);
      const email = normalizeEmail(record.email);
      if (phone) byPhone.set(phone, record);
      if (email) byEmail.set(email, record);
      const imports = record.measurements?.profile?.legacyImports || [];
      imports.forEach((item) => { if (item?.sourceId) bySource.set(String(item.sourceId), record); });
    }

    const stats = {
      spreadsheetRows: input.length, skippedWithoutName: 0, inserted: 0,
      matchedExisting: 0, mergedSpreadsheetDuplicates: 0, updated: 0,
      withPhone: 0, withoutPhone: 0, withEmail: 0, withMeasurements: 0,
    };
    const touched = new Set();

    for (const [index, row] of input.entries()) {
      const fullName = clean(row.C || row.B).slice(0, 160);
      if (!fullName) { stats.skippedWithoutName += 1; continue; }
      const rawPhone = clean(row.L || row.K);
      const phone = normalizePhone(rawPhone);
      const email = normalizeEmail(row.I);
      const idFromSource = sourceId(row, index);
      const measurement = clean(row.AL || row.AN);
      const notes = clean([row.N, row.O].filter(Boolean).join('\n'));
      const address = clean(row.AM || row.Q);
      const importedAt = excelDate(row.AD);
      if (phone) stats.withPhone += 1; else stats.withoutPhone += 1;
      if (email) stats.withEmail += 1;
      if (measurement) stats.withMeasurements += 1;

      let record = bySource.get(idFromSource) || (phone && byPhone.get(phone)) || (email && byEmail.get(email));
      const matchedBeforeThisRun = record && !touched.has(record.id);
      if (record) {
        if (matchedBeforeThisRun) stats.matchedExisting += 1;
        else stats.mergedSpreadsheetDuplicates += 1;
        const existingMeasurements = record.measurements || {};
        const existingProfile = existingMeasurements.profile || {};
        const legacyImports = Array.isArray(existingProfile.legacyImports) ? existingProfile.legacyImports : [];
        const hasSource = legacyImports.some((item) => String(item?.sourceId) === idFromSource);
        const nextMeasurements = {
          ...existingMeasurements,
          ...(measurement ? { additionalInformation: mergeText(existingMeasurements.additionalInformation, measurement) } : {}),
          profile: {
            ...existingProfile,
            ...(notes ? { notes: mergeText(existingProfile.notes, notes) } : {}),
            ...(address && !existingProfile.address ? { address } : {}),
            legacyImports: hasSource ? legacyImports : [...legacyImports, {
              sourceId: idFromSource, spreadsheetRow: index + 2, rawPhone: rawPhone || null,
            }],
          },
        };
        record = { ...record, phone: record.phone || phone, email: record.email || email, measurements: nextMeasurements };
        const position = records.findIndex((candidate) => candidate.id === record.id);
        records[position] = record;
      } else {
        const id = crypto.randomUUID();
        const category = clean(row.AG || row.AK) || 'Active';
        const createdAt = importedAt || new Date();
        const measurements = {
          ...(measurement ? { additionalInformation: measurement } : {}),
          profile: {
            ...(notes ? { notes } : {}),
            ...(address ? { address } : {}),
            legacyImports: [{ sourceId: idFromSource, spreadsheetRow: index + 2, rawPhone: rawPhone || null }],
          },
        };
        record = {
          id, fullName, phone, email, category: category.slice(0, 80), measurements,
          portalToken: crypto.randomBytes(32).toString('hex'), createdAt, existing: false,
        };
        records.push(record);
        stats.inserted += 1;
      }
      touched.add(record.id);
      if (phone) byPhone.set(phone, record);
      if (email) byEmail.set(email, record);
      bySource.set(idFromSource, record);
    }

    const inserts = records.filter((record) => !record.existing);
    const updates = records.filter((record) => record.existing && touched.has(record.id));
    stats.updated = updates.length;
    if (inserts.length) {
      await client.query(`
        INSERT INTO "Customers"
          (id, "fullName", phone, email, category, "storeCreditBalance", measurements, "portalToken", "createdAt", "updatedAt")
        SELECT id::uuid, full_name, phone, email, category, 0, measurements, portal_token, created_at::timestamptz, created_at::timestamptz
        FROM jsonb_to_recordset($1::jsonb) AS source(
          id text, full_name text, phone text, email text, category text,
          measurements jsonb, portal_token text, created_at text
        )
      `, [JSON.stringify(inserts.map((record) => ({
        id: record.id, full_name: record.fullName, phone: record.phone, email: record.email,
        category: record.category, measurements: record.measurements,
        portal_token: record.portalToken, created_at: record.createdAt.toISOString(),
      })))]);
    }
    if (updates.length) {
      await client.query(`
        UPDATE "Customers" AS customer SET
          phone = COALESCE(customer.phone, source.phone),
          email = COALESCE(customer.email, source.email),
          measurements = source.measurements,
          "updatedAt" = NOW()
        FROM jsonb_to_recordset($1::jsonb) AS source(id text, phone text, email text, measurements jsonb)
        WHERE customer.id = source.id::uuid
      `, [JSON.stringify(updates.map((record) => ({
        id: record.id, phone: record.phone, email: record.email, measurements: record.measurements,
      })))]);
    }

    const after = await client.query('SELECT COUNT(*)::int AS count FROM "Customers"');
    stats.databaseBefore = existingResult.rowCount;
    stats.databaseAfter = after.rows[0].count;
    stats.mode = apply ? 'applied' : 'dry-run-rolled-back';
    if (apply) await client.query('COMMIT'); else await client.query('ROLLBACK');
    console.log(JSON.stringify(stats, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

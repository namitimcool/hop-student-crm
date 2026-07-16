// ---------------------------------------------------------------------------
// server/utils/csvImport.js
// Bulk candidate import from CSV. Firestore-backed replacement for the
// original better-sqlite3 transaction-based importer — same duplicate
// detection logic (by mobile or email), now batched Firestore writes
// (max 500 ops per batch, per Firestore limits).
// ---------------------------------------------------------------------------

const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../firebase');
const { listAll, nowIso } = require('./firestoreHelpers');

const HEADER_MAP = {
  name: 'name',
  'candidate name': 'name',
  'full name': 'name',
  mobile: 'mobile',
  'mobile number': 'mobile',
  phone: 'mobile',
  'phone number': 'mobile',
  'contact number': 'mobile',
  whatsapp: 'whatsapp',
  'whatsapp number': 'whatsapp',
  email: 'email',
  'email address': 'email',
  city: 'city',
  experience: 'experience',
  skills: 'skills',
  'current company': 'currentCompany',
  'current ctc': 'currentCTC',
  'expected ctc': 'expectedCTC',
  'notice period': 'noticePeriod',
  notes: 'notes',
  'other notes': 'notes',
};

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase();
}

function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/[^\d+]/g, '').trim();
}

function parseCsvFile(filePath) {
  const raw = fs.readFileSync(filePath);
  return parse(raw, {
    columns: (headerRow) => headerRow.map((h) => HEADER_MAP[normalizeHeader(h)] || normalizeHeader(h).replace(/\s+/g, '_')),
    skip_empty_lines: true,
    trim: true,
  });
}

async function importCandidatesFromCsv(filePath) {
  const records = parseCsvFile(filePath);
  const existing = await listAll('candidates');
  const existingMobiles = new Set(existing.map((c) => normalizePhone(c.mobile)).filter(Boolean));
  const existingEmails = new Set(existing.map((c) => (c.email || '').trim().toLowerCase()).filter(Boolean));

  let inserted = 0;
  let skippedDuplicates = 0;
  let skippedInvalid = 0;
  const errors = [];

  let batch = db.batch();
  let opsInBatch = 0;

  for (const row of records) {
    const name = (row.name || '').trim();
    const mobile = normalizePhone(row.mobile);
    const email = (row.email || '').trim().toLowerCase();

    if (!name || (!mobile && !email)) {
      skippedInvalid++;
      continue;
    }
    if ((mobile && existingMobiles.has(mobile)) || (email && existingEmails.has(email))) {
      skippedDuplicates++;
      continue;
    }

    try {
      const id = uuidv4();
      const skills = (row.skills || '').split(',').map((s) => s.trim()).filter(Boolean);
      const ref = db.collection('candidates').doc(id);
      batch.set(ref, {
        id, name, mobile: mobile || '', whatsapp: row.whatsapp || mobile || '', email: email || '',
        city: row.city || '', experience: row.experience || '', skills,
        currentCompany: row.currentCompany || '', currentCTC: row.currentCTC || '',
        expectedCTC: row.expectedCTC || '', noticePeriod: row.noticePeriod || '',
        notes: row.notes || '', status: 'New',
        resumeUrl: '', resumeStoragePath: '', ocrData: null,
        createdAt: nowIso(), updatedAt: nowIso(),
      });
      opsInBatch++;
      inserted++;
      if (mobile) existingMobiles.add(mobile);
      if (email) existingEmails.add(email);

      if (opsInBatch >= 450) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    } catch (err) {
      errors.push(err.message);
    }
  }

  if (opsInBatch > 0) await batch.commit();

  return { totalRows: records.length, inserted, skippedDuplicates, skippedInvalid, errors };
}

module.exports = { importCandidatesFromCsv, normalizePhone };

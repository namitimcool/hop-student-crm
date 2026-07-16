// ---------------------------------------------------------------------------
// server/utils/firestoreHelpers.js
// Small generic helpers shared by every Firestore-backed route. Firestore
// doesn't support SQL-style LIKE / multi-field OR search, so text search
// across collections is done by fetching the collection (optionally
// narrowed by a cheap equality filter first) and filtering in memory —
// completely fine at CRM scale (hundreds-to-low-thousands of records).
// ---------------------------------------------------------------------------

const { v4: uuidv4 } = require('uuid');
const { db, admin } = require('../firebase');

const FieldValue = admin.firestore.FieldValue;

function nowIso() {
  return new Date().toISOString();
}

async function listAll(collection, orderByField = 'createdAt', direction = 'desc') {
  let query = db.collection(collection);
  try {
    query = query.orderBy(orderByField, direction);
  } catch {
    // ignore ordering errors (e.g. field missing on some docs)
  }
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getById(collection, id) {
  const doc = await db.collection(collection).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function create(collection, data, id = null) {
  const docId = id || uuidv4();
  const payload = { ...data, id: docId, createdAt: nowIso(), updatedAt: nowIso() };
  await db.collection(collection).doc(docId).set(payload);
  return payload;
}

async function update(collection, id, data) {
  const ref = db.collection(collection).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return null;
  const payload = { ...data, updatedAt: nowIso() };
  await ref.set(payload, { merge: true });
  const updated = await ref.get();
  return { id: updated.id, ...updated.data() };
}

async function remove(collection, id) {
  const ref = db.collection(collection).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return false;
  await ref.delete();
  return true;
}

async function findWhere(collection, field, value) {
  const snap = await db.collection(collection).where(field, '==', value).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * In-memory text search across multiple string fields (case-insensitive,
 * substring match) — the Firestore-friendly replacement for
 * `WHERE col LIKE '%q%' OR col2 LIKE '%q%' ...`.
 */
function searchInMemory(records, query, fields) {
  if (!query) return records;
  const q = String(query).toLowerCase();
  return records.filter((r) =>
    fields.some((f) => String(r[f] || '').toLowerCase().includes(q))
  );
}

/** Simple equality filters applied in memory after fetching the collection. */
function filterInMemory(records, filters) {
  return records.filter((r) =>
    Object.entries(filters).every(([key, val]) => {
      if (val === undefined || val === null || val === '') return true;
      if (Array.isArray(r[key])) return r[key].includes(val);
      return String(r[key] ?? '').toLowerCase() === String(val).toLowerCase();
    })
  );
}

function isSameDay(isoA, isoB = nowIso()) {
  if (!isoA) return false;
  return String(isoA).slice(0, 10) === String(isoB).slice(0, 10);
}

module.exports = {
  FieldValue,
  nowIso,
  listAll,
  getById,
  create,
  update,
  remove,
  findWhere,
  searchInMemory,
  filterInMemory,
  isSameDay,
};

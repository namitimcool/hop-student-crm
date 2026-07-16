// ---------------------------------------------------------------------------
// client/src/utils/safeData.js
// Central place for defensively normalizing API responses. Every page that
// consumes a list or detail endpoint runs the response through one of
// these before touching it, so a missing field, a transient API failure,
// or an empty Firestore collection can never reach .map()/.filter()/
// .reduce()/.length on a non-array, or .toLocaleString() on a non-number.
// ---------------------------------------------------------------------------

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function asString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

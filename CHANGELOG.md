# CHANGELOG — Frontend Crash Audit (`e.map is not a function`)

## Root cause

The backend response shapes were already consistent (list endpoints return
plain arrays, detail endpoints return plain objects, mutations return the
resource or `{ success, ... }`, errors return `{ error }` with a non-2xx
status — see "Standardized response contract" below). The bug was on the
**frontend**: `Candidates.jsx`, `Companies.jsx`, `Sharing.jsx`, `Payments.jsx`,
`Calendar.jsx`, and the `ShareFormModal`/`PaymentFormModal` list fetches all
called `setState(res.data)` directly with **no `try/catch`** and **no
coercion to an array**. Any transient failure (cold start on Render, an
expired token mid-request, a dropped connection) left the promise rejected
with nothing to fall back on, and — more importantly — nothing on the
frontend enforced "this must be an array" independently of what the network
happened to return, so any shape drift anywhere in the chain surfaced as
`.map is not a function` and blanked the whole page (no error boundary was
catching it).

`CandidateProfile.jsx` and `CompanyProfile.jsx` had the same class of gap
one level down: the detail endpoints merge in related collections
(`activities`, `documents`, `shares`, `payments`, `tags`, `skills`) and
nothing guaranteed those were arrays before `.map()`/`.length` ran on them.

## Standardized response contract (unchanged, now enforced both ends)

- **List endpoints** (`GET /candidates`, `/companies`, `/shares`,
  `/payments`) → always a plain array `[]`, never `{ data: [] }` /
  `{ candidates: [] }` / `{ success, data }`.
- **Detail endpoints** (`GET /candidates/:id`, `/companies/:id`) → a plain
  object `{}`, with related collections merged in as array fields.
- **Mutations** (`POST`/`PUT`) → the created/updated resource object, or
  `{ success: true, ... }` for actions with no natural resource body.
- **Errors** → `{ error: "message" }` with a non-2xx status.

This was already the shape the backend produced — no endpoint's response
shape changed. What changed is that both sides now *enforce* it instead of
just following the convention.

## Files modified

### Backend (defense-in-depth: guarantee the array contract at the source)
- `server/routes/candidates.js` — `GET /` now wraps the response in
  `Array.isArray(rows) ? rows : []`; `GET /:id` now wraps `activities`,
  `documents`, `shares`, `payments` the same way before merging into the
  response object.
- `server/routes/companies.js` — same treatment for `GET /` and the nested
  `documents`/`shares`/`payments` on `GET /:id`.
- `server/routes/candidateShares.js` — `GET /` wraps its response in
  `Array.isArray(rows) ? rows : []`.
- `server/routes/payments.js` — same for `GET /`.

### Frontend (the actual fix — never trust the network, always coerce)
- `client/src/utils/safeData.js` **(new)** — shared `asArray()`,
  `asObject()`, `asNumber()`, `asString()` helpers used everywhere below.
- `client/src/pages/Candidates.jsx` — `load()` wrapped in `try/catch`,
  response coerced with `asArray()`, always resets `loading` in a `finally`.
- `client/src/pages/Companies.jsx` — same treatment.
- `client/src/pages/Sharing.jsx` — same treatment for the shares list;
  `columns` reducer now runs `asArray(shares)` before `.filter()`; the
  drag-end handler now catches a failed `PUT` and re-syncs from the server
  instead of leaving the board in a state the backend never accepted.
- `client/src/pages/Payments.jsx` — same treatment; `totalRevenue`/
  `totalPending` now reduce over `asArray(payments)`.
- `client/src/pages/Calendar.jsx` — response coerced with `asObject()`;
  each of the four buckets (`missed`/`today`/`tomorrow`/`thisWeek`) coerced
  with `asArray()` before `.length`/`.map()`.
- `client/src/pages/CandidateProfile.jsx` — new `normalizeCandidate()`
  guarantees `tags`, `skills`, `activities`, `documents`, `shares`,
  `payments` are always arrays; `load()` wrapped in `try/catch` with a new
  `loadError` state that renders a friendly message (instead of an
  infinite spinner) if the candidate can't be loaded.
- `client/src/pages/CompanyProfile.jsx` — same treatment via a new
  `normalizeCompany()`, plus the same `loadError` state/UI.
- `client/src/pages/ResumeImport.jsx` — `summary.results` coerced with
  `asArray()` before `.map()`.
- `client/src/components/ShareFormModal.jsx` — candidate/company dropdown
  fetches now have `.catch()` and coerce with `asArray()`.
- `client/src/components/PaymentFormModal.jsx` — same treatment.
- `client/src/components/CsvImportModal.jsx` — summary numbers
  (`totalRows`, `inserted`, `skippedDuplicates`, `skippedInvalid`) default
  to `0` with `??` instead of rendering `undefined`.

## What did NOT change
- No UI, styling, layout, or feature behavior changed.
- No response shape changed on any endpoint.
- Dashboard.jsx and StatCard.jsx were not touched (already audited/safe).

## Result
Every page that lists or displays Firestore-backed data now survives:
empty collections, missing documents, missing fields, and API/network
failures — rendering `0`, `[]`, or a friendly inline message instead of a
white screen, on both a fresh Firestore project and an established one.

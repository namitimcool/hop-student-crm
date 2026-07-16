# HOP Recruitment CRM

An internal Applicant Tracking System (ATS) / Recruitment CRM for **House of
Projects**. This is a refactor of the original HOP Student CRM — same React
+ Node/Express codebase and design system, now built around **Candidates**,
**Companies**, **Candidate Sharing**, and **Payments** instead of students
and seminars, backed by **Firebase Firestore** and Google Drive resume
storage instead of local SQLite, with **Firebase Authentication** (email/password).

## What changed from the original CRM

| Area | Before | Now |
|---|---|---|
| Database | SQLite (`better-sqlite3`) | Firebase Firestore |
| Resume storage | Local disk (`server/uploads`) | Google Drive (service account) |
| Auth | Session + hardcoded admin/password | Firebase Authentication (email/password) |
| Core entity | Student | Candidate |
| New modules | — | Companies, Candidate Sharing, Payments |
| Removed | Seminars, SQLite backup/restore | — |
| Repurposed | Pipeline (student funnel) → **Candidate Sharing** board · Calendar (follow-ups) → **Interview & Follow-up Calendar** | |
| Resume OCR | `server/utils/resumeOcr.js` | **Unchanged** — extracted candidate data plus Drive file references |

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS (deploy to **Cloudflare Pages**)
- **Backend**: Node.js + Express (deploy to **Render**)
- **Database**: Firebase Firestore
- **Resume Storage**: Google Drive API (server-side service account)
- **Auth**: Firebase Authentication (Email/Password)

## Project Structure

```
/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── api/client.js    # axios instance, attaches Firebase ID token
│   │   ├── firebase.js      # Firebase client SDK (Auth) init
│   │   ├── context/AuthContext.jsx
│   │   ├── components/      # Sidebar, Layout, Modal, form modals, etc.
│   │   └── pages/           # Dashboard, Candidates, Companies, Sharing, Payments, Calendar, Settings, ResumeImport, Login
│   └── public/_redirects    # Cloudflare Pages SPA routing
├── server/                  # Express backend
│   ├── firebase.js          # Firebase Admin SDK init (Firestore + Auth)
│   ├── middleware/auth.js   # Verifies Firebase ID tokens
│   ├── routes/               # candidates, companies, candidateShares, payments, dashboard, ai, resumes, auth
│   └── utils/                # firestoreHelpers, storageUpload, resumeOcr (unchanged), aiGenerator, csvImport
└── render.yaml               # Render deployment blueprint
```

## Firestore Collections

- `candidates` — name, mobile, whatsapp, email, city, experience, skills, currentCompany, currentCTC, expectedCTC, noticePeriod, resumeUrl, ocrData, notes, status, tags, createdAt
- `companies` — companyName, legalName, brandName, GST/PAN, commercial terms, agreement/invoice settings, and existing contact fields
- `companyContacts` — companyId, name, department, designation, contact details, preferred communication, primary flag
- `candidateShares` — candidateId, companyId, recruiter, position, dateShared, interview status/date, result, offer, joining date, remarks
- `payments` — candidateId, companyId, invoiceNumber, invoiceDate, invoiceAmount, amountReceived, pendingAmount (derived), paymentStatus, paymentDate, notes
- `documents` — candidateId **or** companyId, type (resume / Service Agreement / NDA / Invoice / Other), filename, url, storagePath
- `activities` — candidateId, type, channel, content, createdAt
- `settings/workspace` — editable candidate pipeline stages

### Google Drive resumes

Resume PDFs are stored directly in a folder in your **personal** Google
Drive, using Google OAuth 2.0 (no service account). On Render, set these
server-only environment variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REFRESH_TOKEN`, and `GOOGLE_DRIVE_FOLDER_ID`. They are documented in
`server/.env.example` and must never be set in Cloudflare Pages. See
`GOOGLE_DRIVE_OAUTH_SETUP.md` for how to obtain the client credentials and
generate the refresh token.

## 1. Firebase Project Setup

1. Go to the [Firebase Console](https://console.firebase.google.com) and create a new project.
2. **Authentication** → Sign-in method → enable **Email/Password**. Add your team's accounts under the Users tab (or build a small invite flow later).
3. **Firestore Database** → Create database → start in production mode (any region).
4. **Project Settings → General → Your apps** → add a **Web app**. Copy the config object into `client/.env` (see below).
5. **Project Settings → Service Accounts** → Generate new private key. Use the three values (`project_id`, `client_email`, `private_key`) to fill `server/.env`, **or** save the whole JSON file as `server/firebase-service-account.json` (gitignored).

### Firestore Security Rules

Since all reads/writes go through the authenticated Express backend (using
the Admin SDK, which bypasses rules), you can lock the database down to deny
all direct client access:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 2. Local Setup

```bash
# from the project root
npm run install:all       # installs server + client dependencies

cp server/.env.example server/.env
cp client/.env.example client/.env
# fill in both .env files with your Firebase project's values

npm run dev                # runs backend (:4000) and frontend (:5173) together
```

Open http://localhost:5173, sign in with a Firebase Authentication user you
created in the console.

## 3. Resume OCR Setup

Add to `server/.env`:

```
OCR_API_KEY=your-ocr-api-key
OCR_API_URL=https://api.ocr.space/parse/image   # or your provider's endpoint
```

After OCR extracts raw text, field parsing (name, email, phone, skills,
experience, education, etc.) is done entirely offline using regex, section
detection, and keyword matching — no paid AI API (OpenAI or otherwise) is
used anywhere in this project. Without `OCR_API_KEY`, the Resume Import
page is disabled but the rest of the CRM works normally.

## 4. Deployment

### Backend → Render

1. Push this repo to GitHub.
2. In Render: New → Blueprint → select this repo (`render.yaml` is already configured, root dir `server/`).
3. Add the environment variables listed in `server/.env.example` under the service's **Environment** tab — especially `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, all four `GOOGLE_*` variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID`), and `CLIENT_ORIGIN` (your Cloudflare Pages URL).
4. Deploy. Note the resulting URL, e.g. `https://hop-recruitment-crm-api.onrender.com`.

### Frontend → Cloudflare Pages

1. In Cloudflare Pages: Create a project → connect this repo.
2. Build settings:
   - **Root directory**: `client`
   - **Build command**: `npm install && npm run build`
   - **Build output directory**: `dist`
3. Environment variables: add everything from `client/.env.example`, with `VITE_API_BASE_URL` set to `https://<your-render-app>.onrender.com/api`.
4. Deploy. `client/public/_redirects` is already set up so client-side routing (React Router) works correctly on Cloudflare Pages.
5. Go back to Render and update `CLIENT_ORIGIN` with the final `*.pages.dev` (or custom domain) URL, then redeploy the backend.

## 5. Creating Your First User

Firebase Authentication (Email/Password) doesn't have a public sign-up page
in this CRM by design — it's an internal tool. Add teammates directly in
**Firebase Console → Authentication → Users → Add user**.

## Troubleshooting

- **Pages show "Not found: GET /candidates" (or /shares, /companies, /dashboard/stats)**: `VITE_API_BASE_URL` on Cloudflare Pages is missing the `/api` suffix, or isn't set at all. It must be the full Render URL **including `/api`**, e.g. `https://hop-recruitment-crm-api.onrender.com/api`. (`client/src/api/client.js` auto-appends `/api` if you forget it, so this should now be self-correcting — but redeploy after fixing the env var, since Vite bakes it in at build time, not runtime.)
- **401 errors on every API call**: `server/.env`'s `FIREBASE_PROJECT_ID` must match `client/.env`'s `VITE_FIREBASE_PROJECT_ID` — the backend can only verify tokens issued by the same Firebase project.
- **CORS errors in the browser console**: add your frontend's exact origin (including `https://`, no trailing slash) to `CLIENT_ORIGIN` on the backend.
- **Resume Drive upload fails**: confirm all four `GOOGLE_*` values are set on Render and that `GOOGLE_REFRESH_TOKEN` hasn't been revoked (regenerate it via `/api/google-drive/auth` if needed — see `GOOGLE_DRIVE_OAUTH_SETUP.md`).
- **"No Firebase credentials found" on server startup**: fill in `server/.env`'s `FIREBASE_*` vars or add `server/firebase-service-account.json` (copy from `firebase-service-account.example.json`).

## Deployment Path Checklist

Every frontend API call goes through `client/src/api/client.js`, whose `baseURL` resolves to `VITE_API_BASE_URL` (normalized to always end in `/api`). Every backend route is mounted under `/api/*` in `server/index.js`. Use this table to sanity-check a deployment — each frontend call must land on the matching backend route with **no other path in between**:

| Module | Frontend calls (`client/src/pages/*.jsx`) | Backend route (`server/routes/*.js`) |
|---|---|---|
| Dashboard | `GET /dashboard/stats`, `GET /dashboard/calendar` | `dashboard.js`: `GET /stats`, `GET /calendar` |
| Candidates | `GET/POST /candidates`, `GET/PUT/DELETE /candidates/:id`, `POST /candidates/import/csv`, `POST /candidates/:id/activities` | `candidates.js` (same paths) |
| Companies | `GET/POST /companies`, `GET/PUT/DELETE /companies/:id`, `POST /companies/:id/documents`, `POST /companies/:id/contacts` | `companies.js` (same paths) |
| Candidate Sharing | `GET/POST /shares`, `PUT /shares/:id` | `candidateShares.js` (same paths) |
| Payments | `GET/POST /payments`, `PUT /payments/:id` | `payments.js` (same paths) |
| Resume Import | `POST /resumes/upload` | `resumes.js`: `POST /upload` |
| Calendar | `GET /dashboard/calendar` | `dashboard.js`: `GET /calendar` |
| Auth check | `GET /auth/session` | `auth.js`: `GET /session` |
| Settings | `GET/PUT /settings` | `settings.js`: `GET/PUT /` |

Since the axios `baseURL` already ends in `/api`, none of the paths above include the `/api` prefix themselves — it's added once, centrally.

**Render**: confirm the live service URL (Render dashboard → your service → the `.onrender.com` URL at the top), then confirm `https://<that-url>/api/health` returns `{"status":"ok",...}` in a browser. If it 404s, the backend didn't deploy the latest `server/index.js`; if it works but the frontend still 404s, the problem is `VITE_API_BASE_URL` on the Cloudflare Pages side, not the backend.

**Cloudflare Pages**: Settings → Environment Variables → confirm `VITE_API_BASE_URL` is set for the **Production** environment (not just Preview) and ends in `/api`, then trigger a new deployment — Vite inlines env vars at build time, so changing the variable alone does nothing until you rebuild.

// ---------------------------------------------------------------------------
// server/firebase.js
// Initializes the Firebase Admin SDK once and exports the Firestore
// database handle and Auth handle for use across all routes. Firestore is
// the ONLY Firebase service this project uses — there is no Firebase
// Storage bucket and FIREBASE_STORAGE_BUCKET is not required anywhere.
//
// Credentials can come from either:
//   1) FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
//      env vars (recommended for Render — set these in the dashboard), or
//   2) A service account JSON file at
//      server/firebase-service-account.json (gitignored — copy from
//      firebase-service-account.example.json and fill it in for local dev).
// ---------------------------------------------------------------------------

const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'firebase-service-account.json');

function loadCredential() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      // .env files store the key with literal \n — convert back to real newlines.
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  }

  if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    return admin.credential.cert(require(SERVICE_ACCOUNT_PATH));
  }

  console.warn(
    '⚠️  No Firebase credentials found (env vars or firebase-service-account.json).\n' +
    '   The server will start, but every Firestore/Auth call will fail until\n' +
    '   you add real credentials. See server/.env.example.'
  );
  return admin.credential.applicationDefault();
}

const projectId = process.env.FIREBASE_PROJECT_ID || 'hop-recruitment-crm-placeholder';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: loadCredential(),
    projectId,
  });
  console.log('✅ Firebase Admin SDK initialized (project:', projectId + ')');
}

const db = admin.firestore();
const auth = admin.auth();

// Firestore ignores `undefined` fields by default in newer SDKs, but be explicit.
db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db, auth };

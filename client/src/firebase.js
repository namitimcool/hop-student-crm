// ---------------------------------------------------------------------------
// client/src/firebase.js
// Initializes the Firebase client SDK (Auth only — Firestore/Storage reads
// and writes go through our own backend API, not directly from the
// browser). Values come from Vite env vars — see client/.env.example.
// ---------------------------------------------------------------------------

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'PASTE_YOUR_FIREBASE_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'your-firebase-project-id.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'your-firebase-project-id',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'PASTE_SENDER_ID',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'PASTE_APP_ID',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

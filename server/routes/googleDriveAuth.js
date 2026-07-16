// ---------------------------------------------------------------------------
// server/routes/googleDriveAuth.js
//
// One-time setup flow used ONLY to generate a GOOGLE_REFRESH_TOKEN for a
// personal Google account. It is not used by any candidate/company/resume
// feature at runtime — those all call server/utils/googleDrive.js directly
// with the refresh token already stored in the environment.
//
// Usage (see README.md for the full walkthrough):
//   1. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env
//      (from a Google Cloud OAuth 2.0 Client ID of type "Web application").
//   2. Add this server's callback URL to that OAuth client's
//      "Authorized redirect URIs", e.g. http://localhost:4000/api/google-drive/callback
//   3. Start the server and open GET /api/google-drive/auth in a browser.
//   4. Sign in with the personal Google account that owns the target Drive
//      folder and approve access.
//   5. The callback route prints the refresh token once. Copy it into
//      GOOGLE_REFRESH_TOKEN (locally and on Render) and restart the server.
// ---------------------------------------------------------------------------
const express = require('express');
const { google } = require('googleapis');

const router = express.Router();
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

function redirectUriFor(req) {
  // Derived from the incoming request so no extra env var is required —
  // this must exactly match an "Authorized redirect URI" on the Google
  // Cloud OAuth client (protocol + host + path).
  return `${req.protocol}://${req.get('host')}/api/google-drive/callback`;
}

function oauthClientFor(req) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before starting the Google Drive auth flow.');
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUriFor(req));
}

// --- GET /api/google-drive/auth — redirects to Google's consent screen ---
router.get('/auth', (req, res) => {
  try {
    const oauth2Client = oauthClientFor(req);
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline', // required to receive a refresh_token
      prompt: 'consent', // forces refresh_token to be returned even on repeat runs
      scope: [DRIVE_SCOPE],
    });
    res.redirect(url);
  } catch (err) {
    res.status(500).send(`<pre>${err.message}</pre>`);
  }
});

// --- GET /api/google-drive/callback — Google redirects here with ?code= ---
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send(`<pre>Google returned an error: ${error}</pre>`);
  if (!code) return res.status(400).send('<pre>Missing "code" query parameter.</pre>');

  try {
    const oauth2Client = oauthClientFor(req);
    const { tokens } = await oauth2Client.getToken(String(code));
    if (!tokens.refresh_token) {
      return res.status(200).send(`
        <pre>No refresh_token was returned (Google only sends it the first time you
approve access, or when prompt=consent is used and the app is set up correctly).

Fix: go to https://myaccount.google.com/permissions, remove this app's access,
then visit /api/google-drive/auth again.</pre>
      `);
    }
    // Shown once, directly in the browser response — never logged or stored
    // server-side. Copy it into GOOGLE_REFRESH_TOKEN yourself.
    res.status(200).send(`
      <pre>Google Drive connected successfully.

Copy this value into GOOGLE_REFRESH_TOKEN (in server/.env locally and in your
Render environment variables), then restart the server:

${tokens.refresh_token}

You can close this tab afterwards.</pre>
    `);
  } catch (err) {
    res.status(500).send(`<pre>Token exchange failed: ${err.message}</pre>`);
  }
});

module.exports = router;

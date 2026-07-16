// ---------------------------------------------------------------------------
// server/middleware/auth.js
// Replaces the old express-session admin/password check with Firebase
// Authentication. The frontend signs in with the Firebase client SDK
// (email + password) and sends the resulting ID token on every API
// request as `Authorization: Bearer <token>`. This middleware verifies
// that token with the Admin SDK before letting the request through.
// ---------------------------------------------------------------------------

const { auth } = require('../firebase');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session, please log in again.' });
  }
}

module.exports = { requireAuth };

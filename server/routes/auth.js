// ---------------------------------------------------------------------------
// server/routes/auth.js
// Login/logout itself now happens entirely on the frontend via the Firebase
// Auth client SDK (email + password) — there's no server-side session to
// manage anymore. This route just gives the frontend a way to confirm the
// backend accepts its current Firebase ID token, and is handy for
// debugging deployment/env-var issues (401 here = token or Firebase
// project mismatch between client and server).
// ---------------------------------------------------------------------------

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/session', requireAuth, (req, res) => {
  res.json({ loggedIn: true, uid: req.user.uid, email: req.user.email });
});

module.exports = router;

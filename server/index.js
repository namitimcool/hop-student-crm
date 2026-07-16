require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Initializes Firebase Admin (Firestore + Auth) before anything else uses it.
require('./firebase');

const { requireAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const candidateRoutes = require('./routes/candidates');
const companyRoutes = require('./routes/companies');
const shareRoutes = require('./routes/candidateShares');
const paymentRoutes = require('./routes/payments');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes = require('./routes/ai');
const resumeRoutes = require('./routes/resumes');
const settingsRoutes = require('./routes/settings');
const googleDriveAuthRoutes = require('./routes/googleDriveAuth');

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser requests (curl, server-to-server) with no Origin header.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// --- Public route: verifies the client's Firebase ID token ---
app.use('/api/auth', authRoutes);

// --- Public, one-time setup route: generates GOOGLE_REFRESH_TOKEN for the
// personal Google Drive account. Not used by any CRM feature at runtime;
// see server/routes/googleDriveAuth.js and README.md. ---
app.use('/api/google-drive', googleDriveAuthRoutes);

// --- Protected routes (require a valid Firebase ID token) ---
app.use('/api/candidates', requireAuth, candidateRoutes);
app.use('/api/companies', requireAuth, companyRoutes);
app.use('/api/shares', requireAuth, shareRoutes);
app.use('/api/payments', requireAuth, paymentRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/ai', requireAuth, aiRoutes);
app.use('/api/resumes', requireAuth, resumeRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);

// Every real route lives under /api/*. If a request lands here, it's
// almost always the frontend's VITE_API_BASE_URL missing the /api suffix
// (e.g. hitting /candidates instead of /api/candidates) — say so plainly
// instead of returning Express's default HTML 404.
app.use((req, res) => {
  const hint = req.path.startsWith('/api/')
    ? 'No route matches this path.'
    : `This backend mounts all routes under /api — did the frontend call "${req.path}" instead of "/api${req.path}"? Check VITE_API_BASE_URL.`;
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}`, hint });
});

app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('  HOP Recruitment CRM — Backend Server');
  console.log(`  Running at: http://localhost:${PORT}`);
  console.log('========================================');
  console.log('');
});

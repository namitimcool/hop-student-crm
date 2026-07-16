import axios from 'axios';
import { auth } from '../firebase';

// The Express backend mounts every route under /api (see server/index.js:
// app.use('/api/candidates', ...), app.use('/api/companies', ...), etc).
// VITE_API_BASE_URL should be the full backend URL INCLUDING that /api
// suffix, e.g. https://hop-recruitment-crm-api.onrender.com/api.
//
// resolveBaseUrl() is defensive: it strips trailing slashes and appends
// /api automatically if whoever configured the Cloudflare Pages env var
// left it off (pointing at the bare Render URL). This is what makes
// "Not found: GET /candidates" (a request that landed on the backend
// without the /api prefix) impossible regardless of how the env var was
// entered.
function resolveBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  let base = (configured || '/api').trim().replace(/\/+$/, '');

  if (!configured && typeof window !== 'undefined' && !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
    // Deployed (Cloudflare Pages) but no backend URL was configured at
    // build time — '/api' would resolve against the static frontend
    // domain itself, which has no backend behind it. Fail loudly in the
    // console instead of silently 404ing on every request.
    // eslint-disable-next-line no-console
    console.error(
      '[HOP CRM] VITE_API_BASE_URL is not set. Every API call will 404. ' +
      'Set it in Cloudflare Pages > Settings > Environment Variables to ' +
      'your Render backend URL with a trailing /api, e.g. ' +
      'https://your-app.onrender.com/api'
    );
  }

  if (!/\/api$/.test(base)) {
    base = `${base}/api`;
  }
  return base;
}

const api = axios.create({
  baseURL: resolveBaseUrl(),
});

// Attach the current Firebase ID token to every request instead of relying
// on a cookie/session, since the backend now verifies Firebase Auth tokens.
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

import { useEffect, useState } from 'react';
import { Download, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [pipeline, setPipeline] = useState([]);
  const [stage, setStage] = useState('');
  const [savingPipeline, setSavingPipeline] = useState(false);

  useEffect(() => {
    api.get('/auth/session')
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => { api.get('/settings').then((r) => setPipeline(Array.isArray(r.data.pipeline) ? r.data.pipeline : [])).catch(() => setPipeline([])); }, []);

  function addStage() { const clean = stage.trim(); if (clean && !pipeline.includes(clean)) setPipeline((p) => [...p, clean]); setStage(''); }
  async function savePipeline() { setSavingPipeline(true); try { const r = await api.put('/settings', { pipeline }); setPipeline(r.data.pipeline); } finally { setSavingPipeline(false); } }

  const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Connection status and data export.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6 space-y-3">
          <h3 className="font-semibold text-navy-900">🔌 Connection Status</h3>
          <div className="flex items-center gap-2 text-sm">
            {status === 'ok' && <><CheckCircle2 size={16} className="text-emerald-600" /> Connected to backend & Firebase Auth</>}
            {status === 'error' && <><AlertTriangle size={16} className="text-rose-600" /> Could not verify backend session — check FIREBASE_* env vars on the server.</>}
            {status === null && <span className="text-slate-400">Checking…</span>}
          </div>
          <p className="text-sm text-slate-500">Signed in as <strong>{user?.email}</strong></p>
        </div>

        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-navy-900">📤 Export Data</h3>
          <p className="text-sm text-slate-500">Export your candidates as a CSV file, ready to open in Excel or Google Sheets.</p>
          <a href={`${apiBase}/candidates/export/csv`} className="btn-emerald w-fit"><Download size={16} /> Export Candidates as CSV</a>
        </div>

        <div className="card p-6 space-y-4 md:col-span-2">
          <div><h3 className="font-semibold text-navy-900">Candidate pipeline</h3><p className="text-sm text-slate-500 mt-1">These stages are available to your recruitment team. Existing candidates keep their current stage.</p></div>
          <div className="flex flex-wrap gap-2">{pipeline.map((item, index) => <span key={`${item}-${index}`} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 rounded-full px-3 py-1.5 text-sm">{item}<button onClick={() => setPipeline((p) => p.filter((_, i) => i !== index))} className="text-slate-400 hover:text-rose-600" aria-label={`Remove ${item}`}>×</button></span>)}</div>
          <div className="flex gap-2"><input className="input" placeholder="Add a stage…" value={stage} onChange={(e) => setStage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStage())} /><button onClick={addStage} className="btn-secondary shrink-0">Add stage</button><button onClick={savePipeline} disabled={savingPipeline || !pipeline.length} className="btn-emerald shrink-0 disabled:opacity-60">{savingPipeline ? 'Saving…' : 'Save pipeline'}</button></div>
        </div>

        <div className="card p-6 space-y-3 md:col-span-2">
          <h3 className="font-semibold text-navy-900">☁️ Firebase Project</h3>
          <p className="text-sm text-slate-500">
            All candidate, company, sharing, and payment data lives in Firebase Firestore. Resume PDFs are stored in
            the configured Google Drive folder. Manage users and data directly in the Firebase Console.
          </p>
          <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="btn-secondary w-fit">
            Open Firebase Console <ExternalLink size={15} />
          </a>
        </div>
      </div>
    </Layout>
  );
}

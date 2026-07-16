import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Building2 } from 'lucide-react';
import Layout from '../components/Layout';
import CompanyFormModal from '../components/CompanyFormModal';
import api from '../api/client';
import { asArray } from '../utils/safeData';

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/companies', { params: q ? { q } : {} });
      setCompanies(asArray(res.data));
    } catch (err) {
      console.error('Failed to load companies:', err);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => { load(); }, [load]);

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Companies</h1>
          <p className="text-sm text-slate-500 mt-0.5">{companies.length} client companies</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-emerald"><Plus size={16} /> Add Company</button>
      </div>

      <div className="card p-4 mb-5">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Search by company, HR, recruiter, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse text-slate-400">Loading companies…</div>
      ) : companies.length === 0 ? (
        <div className="card p-10 text-center text-slate-400 text-sm">No companies yet. Add your first client company.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {companies.map((c) => (
            <Link key={c.id} to={`/companies/${c.id}`} className="card p-5 hover:border-emerald-300 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center shrink-0"><Building2 size={18} /></div>
                <div className="min-w-0">
                  <div className="font-semibold text-navy-900 truncate">{c.companyName}</div>
                  <div className="text-xs text-slate-400 truncate">{c.website || c.email}</div>
                </div>
              </div>
              {c.hrName && <p className="text-sm text-slate-600">HR: {c.hrName}</p>}
              {c.recruiterName && <p className="text-sm text-slate-600">Recruiter: {c.recruiterName}</p>}
              {c.phone && <p className="text-xs text-slate-400 mt-1">{c.phone}</p>}
            </Link>
          ))}
        </div>
      )}

      <CompanyFormModal open={showForm} onClose={() => setShowForm(false)} onSaved={load} />
    </Layout>
  );
}

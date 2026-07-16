import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, UploadCloud, Download, Filter, X } from 'lucide-react';
import Layout from '../components/Layout';
import CsvImportModal from '../components/CsvImportModal';
import CandidateFormModal from '../components/CandidateFormModal';
import TagBadge from '../components/TagBadge';
import api from '../api/client';
import { asArray } from '../utils/safeData';
import { COMMUNICATION_LEVELS, TECHNICAL_LEVELS, DEPARTMENTS } from '../constants/scorecard';

export const STATUSES = [
  'New', 'CV Reviewed', 'Screening Pending', 'Screened', 'Resume Shared',
  'Interview Scheduled', 'Interview 1', 'Interview 2', 'HR Round',
  'Technical Round', 'Offer Released', 'Offer Accepted', 'Joined', 'Rejected', 'On Hold', 'Placed',
];

const QUICK_FILTERS = [
  { label: 'New', field: 'status', value: 'New' },
  { label: 'Interview Scheduled', field: 'status', value: 'Interview Scheduled' },
  { label: 'Offer Released', field: 'status', value: 'Offer Released' },
  { label: 'Joined', field: 'status', value: 'Joined' },
];

const STATUS_COLORS = {
  New: 'bg-slate-100 text-slate-600',
  'CV Reviewed': 'bg-emerald-50 text-emerald-700',
  Screened: 'bg-emerald-50 text-emerald-700',
  'Resume Shared': 'bg-navy-50 text-navy-700',
  'Interview Scheduled': 'bg-amber-50 text-amber-700',
  'Interview 1': 'bg-navy-50 text-navy-700',
  'Interview 2': 'bg-navy-50 text-navy-700',
  'HR Round': 'bg-navy-50 text-navy-700',
  'Technical Round': 'bg-navy-50 text-navy-700',
  'Offer Released': 'bg-emerald-100 text-emerald-800',
  Joined: 'bg-navy-800 text-white',
  Rejected: 'bg-rose-50 text-rose-700',
  'Not Interested': 'bg-rose-50 text-rose-700',
};

const EMPTY_FILTERS = { status: '', department: '', communication: '', technicalFit: '', sourcedFor: '' };

export default function Candidates() {
  const [candidates, setCandidates] = useState([]);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sourcedForOptions, setSourcedForOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    Object.entries(filters).forEach(([key, val]) => { if (val) params[key] = val; });
    try {
      const res = await api.get('/candidates', { params });
      setCandidates(asArray(res.data));
    } catch (err) {
      console.error('Failed to load candidates:', err);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [q, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/candidates/meta/sourced-for').then((r) => setSourcedForOptions(asArray(r.data))).catch(() => {}); }, []);

  function toggleFilter(f) {
    setFilters((cur) => ({ ...cur, [f.field]: cur[f.field] === f.value ? '' : f.value }));
  }

  function setFilter(field, value) {
    setFilters((cur) => ({ ...cur, [field]: value }));
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Candidates</h1>
          <p className="text-sm text-slate-500 mt-0.5">{candidates.length} candidates found</p>
        </div>
        <div className="flex gap-2">
          <a href={`${import.meta.env.VITE_API_BASE_URL || '/api'}/candidates/export/csv`} className="btn-secondary"><Download size={16} /> Export</a>
          <button onClick={() => setShowImport(true)} className="btn-secondary"><UploadCloud size={16} /> Import CSV</button>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-emerald"><Plus size={16} /> Add Candidate</button>
        </div>
      </div>

      <div className="card p-4 mb-5">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-10"
            placeholder="Search by name, mobile, email, skills, experience, company…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <Filter size={14} className="text-slate-400" />
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => toggleFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                filters[f.field] === f.value
                  ? 'bg-navy-800 text-white border-navy-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-navy-300'
              }`}
            >
              {f.label}
            </button>
          ))}
          {activeFilterCount > 0 && (
            <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs font-medium px-3 py-1.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center gap-1">
              <X size={12} /> Clear all ({activeFilterCount})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Department</label>
            <select className="input !py-2" value={filters.department} onChange={(e) => setFilter('department', e.target.value)}>
              <option value="">All Departments</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Communication</label>
            <select className="input !py-2" value={filters.communication} onChange={(e) => setFilter('communication', e.target.value)}>
              <option value="">Any Communication Level</option>
              {COMMUNICATION_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Technical Fit</label>
            <select className="input !py-2" value={filters.technicalFit} onChange={(e) => setFilter('technicalFit', e.target.value)}>
              <option value="">Any Technical Fit</option>
              {TECHNICAL_LEVELS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Sourced For (Role / Company)</label>
            <input
              className="input !py-2"
              list="sourced-for-options"
              placeholder="e.g. Houzee Telesales"
              value={filters.sourcedFor}
              onChange={(e) => setFilter('sourcedFor', e.target.value)}
            />
            <datalist id="sourced-for-options">
              {sourcedForOptions.map((o) => <option key={o} value={o} />)}
            </datalist>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Sourced For</th>
                <th className="px-5 py-3">Comm / Technical</th>
                <th className="px-5 py-3">Expected CTC</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Date Added</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">Loading…</td></tr>
              )}
              {!loading && candidates.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">No candidates found. Try importing a CSV, scanning a resume, or adding one manually.</td></tr>
              )}
              {candidates.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3">
                    <Link to={`/candidates/${c.id}`} className="font-semibold text-navy-800 hover:text-emerald-700">
                      {c.name}
                    </Link>
                    <div className="text-xs text-slate-400">{c.experience}{c.currentCompany ? ` · ${c.currentCompany}` : ''}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(c.tags || []).slice(0, 2).map((t) => <TagBadge key={t} tag={t} />)}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    <div>{c.mobile}</div>
                    <div className="text-xs text-slate-400">{c.email}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{c.sourcedFor || '—'}</td>
                  <td className="px-5 py-3 text-slate-600">
                    <div className="text-xs">{c.scorecard?.communication || '—'}</div>
                    <div className="text-xs text-slate-400">{c.scorecard?.technicalFit || '—'}</div>
                    {(c.scorecard?.departments || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.scorecard.departments.slice(0, 3).map((d) => (
                          <span key={d} className="badge bg-emerald-50 text-emerald-700 !text-[10px] !px-1.5 !py-0.5">{d}</span>
                        ))}
                        {c.scorecard.departments.length > 3 && <span className="text-[10px] text-slate-400">+{c.scorecard.departments.length - 3}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{c.expectedCTC}</td>
                  <td className="px-5 py-3">
                    <span className={`badge ${STATUS_COLORS[c.status] || 'bg-slate-100 text-slate-600'}`}>{c.status}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CsvImportModal open={showImport} onClose={() => setShowImport(false)} onImported={load} />
      <CandidateFormModal open={showForm} onClose={() => setShowForm(false)} candidate={editing} onSaved={load} />
    </Layout>
  );
}

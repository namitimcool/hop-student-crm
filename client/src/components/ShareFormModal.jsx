import { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../api/client';
import { asArray } from '../utils/safeData';

export default function ShareFormModal({ open, onClose, onSaved }) {
  const [candidates, setCandidates] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ candidateId: '', companyId: '', recruiter: '', position: '', dateShared: new Date().toISOString().slice(0, 10), notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    api.get('/candidates').then((res) => setCandidates(asArray(res.data))).catch(() => setCandidates([]));
    api.get('/companies').then((res) => setCompanies(asArray(res.data))).catch(() => setCompanies([]));
    setError('');
  }, [open]);

  function update(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.candidateId || !form.companyId) {
      setError('Please select both a candidate and a company.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/shares', form);
      onSaved();
      onClose();
      setForm({ candidateId: '', companyId: '', recruiter: '', position: '', dateShared: new Date().toISOString().slice(0, 10), notes: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="🔗 Share a Candidate" width="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</div>}
        <div>
          <label className="label">Candidate*</label>
          <select className="input" value={form.candidateId} onChange={(e) => update('candidateId', e.target.value)} required>
            <option value="">Select a candidate…</option>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.mobile}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Company*</label>
          <select className="input" value={form.companyId} onChange={(e) => update('companyId', e.target.value)} required>
            <option value="">Select a company…</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Position</label><input className="input" value={form.position} onChange={(e) => update('position', e.target.value)} /></div>
          <div><label className="label">Recruiter</label><input className="input" value={form.recruiter} onChange={(e) => update('recruiter', e.target.value)} /></div>
        </div>
        <div>
          <label className="label">Date Shared</label>
          <input type="date" className="input" value={form.dateShared} onChange={(e) => update('dateShared', e.target.value)} />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-emerald disabled:opacity-60">{saving ? 'Sharing…' : 'Share Candidate'}</button>
        </div>
      </form>
    </Modal>
  );
}

import { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../api/client';
import { STATUSES } from '../pages/Candidates';

const EMPTY = {
  name: '', mobile: '', whatsapp: '', email: '', city: '', experience: '',
  skills: '', currentCompany: '', currentCTC: '', expectedCTC: '', noticePeriod: '',
  notes: '', status: 'New', sourcedFor: '',
};

export default function CandidateFormModal({ open, onClose, onSaved, candidate }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stages, setStages] = useState(STATUSES);

  useEffect(() => {
    if (candidate) {
      setForm({ ...EMPTY, ...candidate, skills: (candidate.skills || []).join(', ') });
    } else {
      setForm(EMPTY);
    }
    setError('');
  }, [candidate, open]);

  useEffect(() => {
    if (!open) return;
    api.get('/settings').then((r) => {
      if (!Array.isArray(r.data.pipeline) || !r.data.pipeline.length) return;
      setStages(r.data.pipeline);
      if (!candidate) setForm((f) => r.data.pipeline.includes(f.status) ? f : { ...f, status: r.data.pipeline[0] });
    }).catch(() => {});
  }, [open, candidate]);

  function update(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name || (!form.mobile && !form.email)) {
      setError('Name and at least one of Mobile or Email are required.');
      return;
    }
    if (!form.sourcedFor || !form.sourcedFor.trim()) {
      setError('Please enter which job role or company this candidate was sourced for.');
      return;
    }
    setSaving(true);
    try {
      if (candidate?.id) {
        await api.put(`/candidates/${candidate.id}`, form);
      } else {
        await api.post('/candidates', form);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    ['name', 'Full Name*'], ['mobile', 'Mobile'], ['whatsapp', 'WhatsApp'], ['email', 'Email'],
    ['city', 'City'], ['experience', 'Experience (e.g. 3 years)'], ['currentCompany', 'Current Company'],
    ['currentCTC', 'Current CTC'], ['expectedCTC', 'Expected CTC'], ['noticePeriod', 'Notice Period'],
  ];

  return (
    <Modal open={open} onClose={onClose} title={candidate ? 'Edit Candidate' : 'Add Candidate'} width="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</div>}
        <div>
          <label className="label">Sourced For (Job Role / Company)*</label>
          <input
            className="input"
            placeholder="e.g. Houzee Telesales, Front End Developer, Big 4 Analyst…"
            value={form.sourcedFor || ''}
            onChange={(e) => update('sourcedFor', e.target.value)}
          />
          <p className="text-xs text-slate-400 mt-1">This is how you'll filter and find this candidate later — which role or company you sourced them for.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {fields.map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input className="input" value={form[key] || ''} onChange={(e) => update(key, e.target.value)} />
            </div>
          ))}
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}>
              {stages.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Skills (comma-separated)</label>
          <input className="input" value={form.skills || ''} onChange={(e) => update('skills', e.target.value)} placeholder="React, Node.js, SQL" />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={3} value={form.notes || ''} onChange={(e) => update('notes', e.target.value)} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-emerald disabled:opacity-60">
            {saving ? 'Saving…' : candidate ? 'Save Changes' : 'Add Candidate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

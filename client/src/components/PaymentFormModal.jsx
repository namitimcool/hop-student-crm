import { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../api/client';
import { asArray } from '../utils/safeData';

const EMPTY = {
  candidateId: '', companyId: '', invoiceNumber: '', invoiceDate: '', invoiceAmount: '',
  amountReceived: '', paymentDate: '', notes: '',
};

export default function PaymentFormModal({ open, onClose, onSaved, payment }) {
  const [candidates, setCandidates] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    api.get('/candidates').then((res) => setCandidates(asArray(res.data))).catch(() => setCandidates([]));
    api.get('/companies').then((res) => setCompanies(asArray(res.data))).catch(() => setCompanies([]));
    setForm(payment ? { ...EMPTY, ...payment } : EMPTY);
    setError('');
  }, [open, payment]);

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
      if (payment?.id) await api.put(`/payments/${payment.id}`, form);
      else await api.post('/payments', form);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={payment ? 'Edit Payment' : 'Add Payment'} width="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</div>}
        <div>
          <label className="label">Candidate*</label>
          <select className="input" value={form.candidateId} onChange={(e) => update('candidateId', e.target.value)} disabled={!!payment}>
            <option value="">Select a candidate…</option>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Company*</label>
          <select className="input" value={form.companyId} onChange={(e) => update('companyId', e.target.value)} disabled={!!payment}>
            <option value="">Select a company…</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Invoice Number</label><input className="input" value={form.invoiceNumber} onChange={(e) => update('invoiceNumber', e.target.value)} /></div>
          <div><label className="label">Invoice Date</label><input type="date" className="input" value={form.invoiceDate} onChange={(e) => update('invoiceDate', e.target.value)} /></div>
          <div><label className="label">Invoice Amount (₹)</label><input type="number" className="input" value={form.invoiceAmount} onChange={(e) => update('invoiceAmount', e.target.value)} /></div>
          <div><label className="label">Amount Received (₹)</label><input type="number" className="input" value={form.amountReceived} onChange={(e) => update('amountReceived', e.target.value)} /></div>
          <div><label className="label">Payment Date</label><input type="date" className="input" value={form.paymentDate} onChange={(e) => update('paymentDate', e.target.value)} /></div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-emerald disabled:opacity-60">{saving ? 'Saving…' : payment ? 'Save Changes' : 'Add Payment'}</button>
        </div>
      </form>
    </Modal>
  );
}

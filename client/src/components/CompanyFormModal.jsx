import { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../api/client';

const EMPTY = {
  companyName: '', hrName: '', recruiterName: '', phone: '', email: '',
  website: '', gst: '', pan: '', legalName: '', brandName: '', linkedin: '', industry: '', address: '', notes: '', status: 'Prospect', paymentTerms: '', replacementPeriod: '', creditDays: '', agreementSigned: false, agreementDate: '', invoiceRequired: false, gstPercent: '',
};

export default function CompanyFormModal({ open, onClose, onSaved, company }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(company ? { ...EMPTY, ...company } : EMPTY);
    setError('');
  }, [company, open]);

  function update(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.companyName) {
      setError('Company name is required.');
      return;
    }
    setSaving(true);
    try {
      if (company?.id) {
        await api.put(`/companies/${company.id}`, form);
      } else {
        await api.post('/companies', form);
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
    ['companyName', 'Company Name*'], ['hrName', 'HR Name'], ['recruiterName', 'Recruiter Name'],
    ['legalName', 'Legal Name'], ['brandName', 'Brand Name'], ['phone', 'Phone'], ['email', 'Email'], ['website', 'Website'], ['linkedin', 'LinkedIn'], ['industry', 'Industry'], ['gst', 'GST Number'], ['pan', 'PAN'], ['paymentTerms', 'Payment Terms'], ['replacementPeriod', 'Replacement Period'], ['creditDays', 'Credit Days'], ['gstPercent', 'GST %'],
  ];

  return (
    <Modal open={open} onClose={onClose} title={company ? 'Edit Company' : 'Add Company'} width="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          {fields.map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input className="input" value={form[key] || ''} onChange={(e) => update(key, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Status</label><select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}>{['Prospect', 'Active', 'Inactive', 'Blacklisted'].map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="label">Agreement Date</label><input type="date" className="input" value={form.agreementDate || ''} onChange={(e) => update('agreementDate', e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-slate-700"><label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(form.agreementSigned)} onChange={(e) => update('agreementSigned', e.target.checked)} /> Agreement signed</label><label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(form.invoiceRequired)} onChange={(e) => update('invoiceRequired', e.target.checked)} /> Invoice required</label></div>
        <div>
          <label className="label">Address</label>
          <textarea className="input" rows={2} value={form.address || ''} onChange={(e) => update('address', e.target.value)} />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={3} value={form.notes || ''} onChange={(e) => update('notes', e.target.value)} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-emerald disabled:opacity-60">
            {saving ? 'Saving…' : company ? 'Save Changes' : 'Add Company'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

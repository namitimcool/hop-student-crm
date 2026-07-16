import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, UploadCloud, FileText, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import CompanyFormModal from '../components/CompanyFormModal';
import api from '../api/client';
import { asArray, asObject } from '../utils/safeData';

const DOC_TYPES = ['Service Agreement', 'NDA', 'Invoice', 'Other'];

// The detail endpoint merges the company document with related collections
// (documents/shares/payments) — normalize them to arrays so nothing
// downstream calls .map()/.length on something that isn't an array.
function normalizeCompany(raw) {
  const data = asObject(raw);
  return {
    ...data,
    documents: asArray(data.documents),
    shares: asArray(data.shares),
    payments: asArray(data.payments),
    contacts: asArray(data.contacts),
  };
}

export default function CompanyProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [docType, setDocType] = useState('Service Agreement');
  const [uploading, setUploading] = useState(false);
  const [contact, setContact] = useState({ name: '', department: '', designation: '', phone: '', email: '', preferredCommunication: 'Call', primary: false });
  const fileRef = useRef();

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/companies/${id}`);
      setCompany(normalizeCompany(res.data));
      setLoadError('');
    } catch (err) {
      console.error('Failed to load company:', err);
      setLoadError(err.response?.data?.error || 'Failed to load this company.');
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('document', file);
    fd.append('type', docType);
    try {
      await api.post(`/companies/${id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      load();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function deleteCompany() {
    if (!confirm(`Delete ${company.companyName}? This cannot be undone.`)) return;
    await api.delete(`/companies/${id}`);
    navigate('/companies');
  }

  async function addContact(e) {
    e.preventDefault();
    if (!contact.name.trim()) return;
    await api.post(`/companies/${id}/contacts`, contact);
    setContact({ name: '', department: '', designation: '', phone: '', email: '', preferredCommunication: 'Call', primary: false });
    load();
  }

  if (loadError) {
    return (
      <Layout>
        <button onClick={() => navigate('/companies')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-800 mb-4">
          <ArrowLeft size={16} /> Back to Companies
        </button>
        <div className="card p-10 text-center text-slate-400 text-sm">{loadError}</div>
      </Layout>
    );
  }

  if (!company) return <Layout><div className="animate-pulse text-slate-400">Loading company…</div></Layout>;

  return (
    <Layout>
      <button onClick={() => navigate('/companies')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-800 mb-4">
        <ArrowLeft size={16} /> Back to Companies
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-5">
          <div className="card p-6">
            <h2 className="font-bold text-lg text-navy-900">{company.companyName}</h2>
            {company.website && <a href={company.website} target="_blank" rel="noreferrer" className="text-sm text-emerald-700 hover:underline">{company.website}</a>}
            <div className="mt-4 space-y-2 text-sm">
              <Info label="HR Name" value={company.hrName} />
              <Info label="Recruiter" value={company.recruiterName} />
              <Info label="Phone" value={company.phone} />
              <Info label="Email" value={company.email} />
              <Info label="GST" value={company.gst} />
              <Info label="PAN" value={company.pan} />
              <Info label="Status" value={company.status} />
              <Info label="Payment Terms" value={company.paymentTerms} />
              <Info label="Credit Days" value={company.creditDays} />
              <Info label="Address" value={company.address} />
            </div>
            {company.notes && (
              <div className="mt-4">
                <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Notes</div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{company.notes}</p>
              </div>
            )}
            <button onClick={() => setShowForm(true)} className="btn-secondary w-full justify-center mt-5">Edit Company</button>
          </div>
          <button onClick={deleteCompany} className="w-full flex items-center justify-center gap-2 text-rose-600 text-sm font-medium hover:bg-rose-50 rounded-xl py-2.5 transition-colors">
            <Trash2 size={15} /> Delete Company
          </button>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="card p-6">
            <h3 className="font-semibold text-navy-900 mb-3">Contacts</h3>
            <div className="space-y-2 mb-4">{company.contacts.length === 0 && <p className="text-sm text-slate-400">Add the people who actually move hiring forward.</p>}{company.contacts.map((c) => <div key={c.id} className="border border-slate-100 rounded-xl px-4 py-3"><div className="flex justify-between gap-2"><span className="font-medium text-sm text-navy-800">{c.name} {c.primary && <span className="text-xs text-emerald-700">Primary</span>}</span><span className="text-xs text-slate-400">{c.department || c.designation}</span></div><div className="text-xs text-slate-500 mt-1">{[c.email, c.phone, c.preferredCommunication].filter(Boolean).join(' · ')}</div></div>)}</div>
            <form onSubmit={addContact} className="grid grid-cols-1 sm:grid-cols-2 gap-2"><input className="input" placeholder="Contact name *" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} /><input className="input" placeholder="Department / designation" value={contact.department} onChange={(e) => setContact((c) => ({ ...c, department: e.target.value }))} /><input className="input" placeholder="Email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} /><input className="input" placeholder="Phone" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} /><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={contact.primary} onChange={(e) => setContact((c) => ({ ...c, primary: e.target.checked }))} /> Primary contact</label><button className="btn-secondary justify-center" type="submit">Add contact</button></form>
          </div>
          <div className="card p-6">
            <h3 className="font-semibold text-navy-900 mb-3">Documents</h3>
            <div className="flex gap-2 mb-4">
              <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={() => fileRef.current.click()} disabled={uploading} className="btn-emerald shrink-0 disabled:opacity-60">
                <UploadCloud size={16} /> {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
            </div>
            <div className="space-y-2">
              {(company.documents || []).length === 0 && <p className="text-sm text-slate-400">No documents uploaded yet.</p>}
              {(company.documents || []).map((d) => (
                <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 border border-slate-100 rounded-xl px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <FileText size={16} className="text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-navy-800 truncate">{d.filename}</div>
                    <div className="text-xs text-slate-400">{d.type}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-navy-900 mb-3">Candidates Shared With This Company</h3>
            <div className="space-y-2">
              {(company.shares || []).length === 0 && <p className="text-sm text-slate-400">No candidates shared yet.</p>}
              {(company.shares || []).map((s) => (
                <Link key={s.id} to={`/candidates/${s.candidateId}`} className="flex items-center justify-between border border-slate-100 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="font-medium text-sm text-navy-800">{s.position || 'Position not specified'}</div>
                    <div className="text-xs text-slate-400">Shared {s.dateShared}</div>
                  </div>
                  <span className="badge bg-navy-50 text-navy-700">{s.interviewStatus}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-navy-900 mb-3">Payments</h3>
            <div className="space-y-2">
              {(company.payments || []).length === 0 && <p className="text-sm text-slate-400">No payment records yet.</p>}
              {(company.payments || []).map((p) => (
                <div key={p.id} className="flex items-center justify-between border border-slate-100 rounded-xl px-4 py-3">
                  <div>
                    <div className="font-medium text-sm text-navy-800">Invoice {p.invoiceNumber || '—'}</div>
                    <div className="text-xs text-slate-400">₹{Number(p.invoiceAmount || 0).toLocaleString('en-IN')} · pending ₹{Number(p.pendingAmount || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <span className="badge bg-amber-50 text-amber-700">{p.paymentStatus}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <CompanyFormModal open={showForm} onClose={() => setShowForm(false)} onSaved={load} company={company} />
    </Layout>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="text-navy-800 font-medium text-right">{value || '—'}</span>
    </div>
  );
}

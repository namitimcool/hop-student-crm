import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { UploadCloud, FileText, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api/client';
import { asArray } from '../utils/safeData';

export default function ResumeImport() {
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [sourcedFor, setSourcedFor] = useState('');
  const [sourcedForError, setSourcedForError] = useState('');
  const inputRef = useRef();

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList).filter((f) => /\.(pdf|jpe?g|png|webp)$/i.test(f.name));
    setQueue((prev) => [...prev, ...files]);
  }, []);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  async function handleUpload() {
    if (queue.length === 0) return;
    if (!sourcedFor.trim()) {
      setSourcedForError('Tell us which job role or company these resumes are for before scanning.');
      return;
    }
    setSourcedForError('');
    setUploading(true);
    setSummary(null);
    const fd = new FormData();
    queue.forEach((f) => fd.append('resumes', f));
    fd.append('sourcedFor', sourcedFor.trim());
    try {
      const res = await api.post('/resumes/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSummary(res.data);
      setQueue([]);
    } catch (err) {
      setSummary({ error: err.response?.data?.error || 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">📄 Resume Import (OCR)</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Drop candidate resumes here — the CRM reads each file, pulls out their details, and adds them as a new candidate automatically. Duplicates (matched by phone or email) are rejected and skipped.
        </p>
      </div>

      <div className="card p-5 mb-5">
        <label className="label">For which job role / company are these resumes? *</label>
        <input
          className="input"
          placeholder="e.g. Houzee Telesales, Front End Developer, Big 4 Analyst…"
          value={sourcedFor}
          onChange={(e) => { setSourcedFor(e.target.value); if (e.target.value.trim()) setSourcedForError(''); }}
        />
        {sourcedForError && <p className="text-sm text-rose-600 mt-1.5">{sourcedForError}</p>}
        <p className="text-xs text-slate-400 mt-1.5">Applied to every resume in this batch — this is how you'll filter candidates by role or company later.</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
        className={`card p-10 flex flex-col items-center justify-center gap-3 cursor-pointer border-2 border-dashed transition-colors ${
          dragOver ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-200'
        }`}
      >
        <UploadCloud size={36} className="text-emerald-600" />
        <p className="font-medium text-navy-800">Drag & drop resumes here, or click to browse</p>
        <p className="text-xs text-slate-400">Supports PDF, JPG, PNG, WEBP — multiple files at once</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {queue.length > 0 && (
        <div className="card p-5 mt-5">
          <h3 className="font-semibold text-navy-900 text-sm mb-3">{queue.length} file(s) ready to scan</h3>
          <div className="space-y-2 mb-4 max-h-56 overflow-y-auto pr-1">
            {queue.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                <FileText size={15} className="text-slate-400 shrink-0" />
                <span className="truncate">{f.name}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setQueue([])} className="btn-secondary">Clear</button>
            <button onClick={handleUpload} disabled={uploading} className="btn-emerald disabled:opacity-60">
              {uploading ? (<><Loader2 size={16} className="animate-spin" /> Scanning resumes…</>) : `Scan & Import ${queue.length} Resume(s)`}
            </button>
          </div>
        </div>
      )}

      {summary?.error && (
        <div className="card p-5 mt-5 text-sm text-rose-700 bg-rose-50">{summary.error}</div>
      )}

      {summary && !summary.error && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-emerald-700">{summary.imported}</div>
              <div className="text-xs text-slate-500">Imported</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{summary.duplicates}</div>
              <div className="text-xs text-slate-500">Duplicates Rejected</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-rose-600">{summary.failed}</div>
              <div className="text-xs text-slate-500">Failed to Read</div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                  <th className="px-5 py-3">File</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Extracted Details</th>
                  <th className="px-5 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {asArray(summary.results).map((r, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-5 py-3 text-slate-700 max-w-[10rem] truncate">{r.filename}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-xs">
                      {r.fields?.name && <div className="font-medium text-navy-800 text-sm">{r.fields.name}</div>}
                      {r.fields?.phone && <div>{r.fields.phone}</div>}
                      {r.fields?.email && <div>{r.fields.email}</div>}
                      {r.fields?.college && <div className="text-slate-400">{r.fields.college}</div>}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {r.status === 'imported' && (
                        <Link to={`/candidates/${r.candidateId}`} className="text-emerald-700 font-medium hover:underline">View Profile →</Link>
                      )}
                      {r.status === 'duplicate' && r.matchedCandidateId && (
                        <Link to={`/candidates/${r.matchedCandidateId}`} className="text-amber-700 hover:underline">{r.reason}</Link>
                      )}
                      {r.status === 'failed' && r.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card p-5 mt-5 text-sm text-slate-500">
        <strong className="text-navy-800">Setup note:</strong> Resume scanning requires an OCR API key. Add <code>OCR_API_KEY</code> (and optionally <code>OCR_API_URL</code>) to <code>server/.env</code>, then restart the CRM. Adding an <code>OPENAI_API_KEY</code> as well improves accuracy, since extracted text is structured into fields using AI when available.
      </div>
    </Layout>
  );
}

function StatusBadge({ status }) {
  const map = {
    imported: { icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700', label: 'Imported' },
    duplicate: { icon: AlertTriangle, cls: 'bg-amber-50 text-amber-700', label: 'Duplicate — Rejected' },
    failed: { icon: XCircle, cls: 'bg-rose-50 text-rose-700', label: 'Failed' }
  };
  const { icon: Icon, cls, label } = map[status] || map.failed;
  return (
    <span className={`badge ${cls} inline-flex items-center gap-1`}>
      <Icon size={13} /> {label}
    </span>
  );
}

import { useState } from 'react';
import Modal from './Modal';
import api from '../api/client';
import { UploadCloud } from 'lucide-react';

export default function CsvImportModal({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function reset() {
    setFile(null);
    setResult(null);
    setError('');
  }

  async function handleImport() {
    if (!file) return;
    setUploading(true);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post('/candidates/import/csv', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      onImported();
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed.');
    } finally {
      setUploading(false);
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="📥 Import Candidates from CSV">
      {!result ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Upload a CSV with columns like Name, Mobile, WhatsApp, Email, City, Experience, Skills,
            Current Company, Current CTC, Expected CTC, Notice Period, Notes.
            Duplicate candidates (matched by mobile or email) are automatically skipped.
          </p>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-10 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors">
            <UploadCloud size={32} className="text-emerald-600" />
            <span className="text-sm font-medium text-navy-800">
              {file ? file.name : 'Click to select a CSV file'}
            </span>
            <input type="file" accept=".csv" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
          </label>
          {error && <div className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</div>}
          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={handleClose}>Cancel</button>
            <button className="btn-emerald disabled:opacity-60" disabled={!file || uploading} onClick={handleImport}>
              {uploading ? 'Importing…' : 'Import Candidates'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-emerald-50 text-emerald-800 rounded-xl p-4 text-sm">
            ✅ Import complete!
          </div>
          <ul className="text-sm space-y-1.5 text-slate-700">
            <li>Total rows read: <strong>{result.totalRows ?? 0}</strong></li>
            <li>New candidates added: <strong className="text-emerald-700">{result.inserted ?? 0}</strong></li>
            <li>Duplicates skipped: <strong>{result.skippedDuplicates ?? 0}</strong></li>
            <li>Invalid rows skipped: <strong>{result.skippedInvalid ?? 0}</strong></li>
          </ul>
          <div className="flex justify-end">
            <button className="btn-emerald" onClick={handleClose}>Done</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

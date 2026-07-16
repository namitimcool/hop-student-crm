import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, MessageSquare, FileText, ClipboardList, Sparkles, Copy, Check, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import TagBadge, { ALL_TAGS } from '../components/TagBadge';
import { STATUSES } from './Candidates';
import api from '../api/client';
import { asArray, asObject } from '../utils/safeData';
import { COMMUNICATION_LEVELS, TECHNICAL_LEVELS, DEPARTMENTS, RECOMMENDATIONS } from '../constants/scorecard';

const GEN_ACTIONS = [
  { kind: 'whatsapp', label: 'Generate WhatsApp Message', icon: '💬' },
  { kind: 'email', label: 'Generate Email', icon: '📧' },
  { kind: 'call_script', label: 'Generate Call Script', icon: '☎️' },
  { kind: 'followup', label: 'Generate Follow-up', icon: '📝' },
  { kind: 'meeting_notes', label: 'Generate Meeting Notes', icon: '📋' },
];

// Turns a raw JSON key like "client_name" or "clientName" into "Client Name"
function formatJsonLabel(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function formatJsonValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return String(value);
}

// Renders a JSON object as a two-column table (Field | Value). Nested objects
// are rendered as their own nested table inside the value cell; arrays of
// objects are rendered as one nested table per item.
function JsonTable({ data }) {
  if (data === null || data === undefined) return <span className="text-slate-400">—</span>;
  if (typeof data !== 'object') return <span>{formatJsonValue(data)}</span>;

  const entries = Array.isArray(data) ? data.map((v, i) => [i, v]) : Object.entries(data);
  if (!entries.length) return <span className="text-slate-400">—</span>;

  return (
    <table className="w-full text-sm border-collapse">
      <tbody>
        {entries.map(([key, value]) => {
          const isNested = value !== null && typeof value === 'object';
          return (
            <tr key={key} className="border-b border-slate-100 last:border-b-0 align-top">
              <td className="py-2 pr-4 font-medium text-navy-800 whitespace-nowrap w-1/3">
                {Array.isArray(data) ? `Item ${Number(key) + 1}` : formatJsonLabel(key)}
              </td>
              <td className="py-2 text-slate-600">
                {isNested ? <JsonTable data={value} /> : formatJsonValue(value)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// The detail endpoint merges the candidate document with several related
// collections (activities/documents/shares/payments) and array fields
// (tags/skills). Normalize every one of them here so nothing downstream
// ever calls .map()/.length on something that isn't an array.
function normalizeCandidate(raw) {
  const data = asObject(raw);
  return {
    ...data,
    tags: asArray(data.tags),
    skills: asArray(data.skills),
    activities: asArray(data.activities),
    documents: asArray(data.documents),
    shares: asArray(data.shares),
    payments: asArray(data.payments),
  };
}

export default function CandidateProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('overview');
  const [genOpen, setGenOpen] = useState(false);
  const [genText, setGenText] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [genSource, setGenSource] = useState('');
  const [copied, setCopied] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [stages, setStages] = useState(STATUSES);
  const [replacingResume, setReplacingResume] = useState(false);
  const [ocrView, setOcrView] = useState('table'); // 'table' | 'raw'
  const resumeInputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/candidates/${id}`);
      setCandidate(normalizeCandidate(res.data));
      setLoadError('');
    } catch (err) {
      console.error('Failed to load candidate:', err);
      setLoadError(err.response?.data?.error || 'Failed to load this candidate.');
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/settings').then((r) => Array.isArray(r.data.pipeline) && setStages(r.data.pipeline)).catch(() => {}); }, []);

  async function updateField(field, value) {
    const res = await api.put(`/candidates/${id}`, { [field]: value });
    setCandidate((c) => normalizeCandidate({ ...c, ...res.data }));
  }

  function toggleTag(tag) {
    const current = candidate.tags || [];
    const updated = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    updateField('tags', updated);
  }

  function updateScorecard(field, value) {
    updateField('scorecard', { ...(candidate.scorecard || {}), [field]: value });
  }

  function toggleScorecardDepartment(dept) {
    const current = candidate.scorecard?.departments || [];
    const updated = current.includes(dept) ? current.filter((d) => d !== dept) : [...current, dept];
    updateScorecard('departments', updated);
  }

  async function openGenerator(kind) {
    setGenOpen(true);
    setGenText('');
    setGenLoading(true);
    setCopied(false);
    try {
      const res = await api.post(`/ai/generate/${kind}`, { candidate_id: id, log: true });
      setGenText(res.data.text);
      setGenSource(res.data.source);
    } catch (err) {
      setGenText('Failed to generate message. ' + (err.response?.data?.error || ''));
    } finally {
      setGenLoading(false);
      load();
    }
  }

  function copyText() {
    navigator.clipboard.writeText(genText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function addNote() {
    if (!noteText.trim()) return;
    await api.post(`/candidates/${id}/activities`, { type: 'note', content: noteText });
    setNoteText('');
    load();
  }

  async function toggleNotePin(activity) {
    await api.patch(`/candidates/${id}/activities/${activity.id}`, { pinned: !activity.pinned });
    load();
  }

  async function deleteCandidate() {
    if (!confirm(`Delete ${candidate.name}? This cannot be undone.`)) return;
    await api.delete(`/candidates/${id}`);
    navigate('/candidates');
  }

  async function replaceResume(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setReplacingResume(true);
    const form = new FormData();
    form.append('resume', file);
    try {
      await api.post(`/candidates/${id}/resume`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      await load();
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Resume replacement failed.');
    } finally {
      setReplacingResume(false);
      event.target.value = '';
    }
  }

  async function deleteResume() {
    if (!confirm('Remove this resume from Google Drive? This cannot be undone.')) return;
    setReplacingResume(true);
    try {
      await api.delete(`/candidates/${id}/resume`);
      await load();
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Resume deletion failed.');
    } finally {
      setReplacingResume(false);
    }
  }

  if (loadError) {
    return (
      <Layout>
        <button onClick={() => navigate('/candidates')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-800 mb-4">
          <ArrowLeft size={16} /> Back to Candidates
        </button>
        <div className="card p-10 text-center text-slate-400 text-sm">{loadError}</div>
      </Layout>
    );
  }

  if (!candidate) {
    return <Layout><div className="animate-pulse text-slate-400">Loading candidate…</div></Layout>;
  }

  return (
    <Layout>
      <button onClick={() => navigate('/candidates')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-800 mb-4">
        <ArrowLeft size={16} /> Back to Candidates
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: profile card */}
        <div className="lg:col-span-1 space-y-5">
          <div className="card p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-navy-800 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-3">
              {candidate.photoUrl ? (
                <img src={candidate.photoUrl} alt={candidate.name} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                candidate.name?.slice(0, 1).toUpperCase()
              )}
            </div>
            <h2 className="font-bold text-lg text-navy-900">{candidate.name}</h2>
            <p className="text-sm text-slate-500">{candidate.experience} {candidate.currentCompany ? `· ${candidate.currentCompany}` : ''}</p>
            <p className="text-xs text-slate-400 mt-0.5">{candidate.city}</p>

            <div className="flex justify-center gap-2 mt-4">
              {candidate.mobile && <a href={`tel:${candidate.mobile}`} className="btn-secondary !px-3 !py-2"><Phone size={15} /></a>}
              {candidate.whatsapp && <a href={`https://wa.me/${candidate.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="btn-secondary !px-3 !py-2"><MessageSquare size={15} /></a>}
              {candidate.email && <a href={`mailto:${candidate.email}`} className="btn-secondary !px-3 !py-2"><Mail size={15} /></a>}
              {(candidate.driveWebViewLink || candidate.resumeUrl) && <a href={candidate.driveWebViewLink || candidate.resumeUrl} target="_blank" rel="noreferrer" className="btn-secondary !px-3 !py-2" title="Open Resume"><FileText size={15} /></a>}
            </div>

            <div className="flex flex-wrap justify-center gap-1.5 mt-4">
              {(candidate.tags || []).map((t) => <TagBadge key={t} tag={t} />)}
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-navy-900 text-sm">Status & Compensation</h3>
            <div>
              <label className="label">Status</label>
              <select className="input" value={candidate.status || stages[0]} onChange={(e) => updateField('status', e.target.value)}>
                {stages.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sourced For (Job Role / Company)</label>
              <input
                className="input"
                placeholder="e.g. Houzee Telesales"
                value={candidate.sourcedFor || ''}
                onChange={(e) => setCandidate((c) => ({ ...c, sourcedFor: e.target.value }))}
                onBlur={(e) => updateField('sourcedFor', e.target.value)}
              />
            </div>
            <Info label="Current CTC" value={candidate.currentCTC} />
            <Info label="Expected CTC" value={candidate.expectedCTC} />
            <Info label="Notice Period" value={candidate.noticePeriod} />
            <div>
              <label className="label">Next Follow-up</label>
              <input type="date" className="input" value={candidate.nextFollowUp ? candidate.nextFollowUp.slice(0, 10) : ''} onChange={(e) => updateField('nextFollowUp', e.target.value)} />
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-navy-900 text-sm">Resume</h3>
            {candidate.driveWebViewLink ? (
              <>
                <a href={candidate.driveWebViewLink} target="_blank" rel="noreferrer" className="btn-secondary w-full justify-center"><FileText size={15} /> View Resume</a>
                {candidate.driveDownloadLink && <a href={candidate.driveDownloadLink} target="_blank" rel="noreferrer" className="btn-secondary w-full justify-center">Download Resume</a>}
                <button onClick={() => resumeInputRef.current?.click()} disabled={replacingResume} className="btn-emerald w-full justify-center disabled:opacity-60">{replacingResume ? 'Working…' : 'Replace Resume'}</button>
                <button onClick={deleteResume} disabled={replacingResume} className="btn-secondary w-full justify-center disabled:opacity-60 text-red-600">Delete Resume</button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-400">No Drive resume stored yet.</p>
                <button onClick={() => resumeInputRef.current?.click()} disabled={replacingResume} className="btn-emerald w-full justify-center disabled:opacity-60">{replacingResume ? 'Uploading…' : 'Upload Resume'}</button>
              </>
            )}
            <input ref={resumeInputRef} className="hidden" type="file" accept="application/pdf" onChange={replaceResume} />
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-navy-900 text-sm mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {ALL_TAGS.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleTag(t)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                    (candidate.tags || []).includes(t) ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button onClick={deleteCandidate} className="w-full flex items-center justify-center gap-2 text-rose-600 text-sm font-medium hover:bg-rose-50 rounded-xl py-2.5 transition-colors">
            <Trash2 size={15} /> Delete Candidate
          </button>
        </div>

        {/* Right: tabs */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-1.5 flex gap-1 flex-wrap">
            {[
              ['overview', 'Overview'],
              ['scorecard', 'Scorecard'],
              ['communication', 'Communication'],
              ['shares', `Shares (${candidate.shares?.length || 0})`],
              ['payments', `Payments (${candidate.payments?.length || 0})`],
              ['history', 'Activity'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 text-sm font-medium py-2 rounded-xl transition-colors ${tab === key ? 'bg-navy-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="card p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Info label="Mobile" value={candidate.mobile} />
                <Info label="WhatsApp" value={candidate.whatsapp} />
                <Info label="Email" value={candidate.email} />
                <Info label="City" value={candidate.city} />
                <Info label="Experience" value={candidate.experience} />
                <Info label="Skills" value={(candidate.skills || []).join(', ') || '—'} />
                <Info label="Last Contact" value={candidate.lastContact ? new Date(candidate.lastContact).toLocaleString() : '—'} />
                <Info label="Date Added" value={candidate.createdAt ? new Date(candidate.createdAt).toLocaleDateString() : '—'} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  rows={4}
                  value={candidate.notes || ''}
                  onChange={(e) => setCandidate((c) => ({ ...c, notes: e.target.value }))}
                  onBlur={(e) => updateField('notes', e.target.value)}
                />
              </div>
              {candidate.ocrData && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="label mb-0">Raw OCR Data (from resume scan)</label>
                    <button
                      type="button"
                      onClick={() => setOcrView((v) => (v === 'table' ? 'raw' : 'table'))}
                      className="text-xs font-medium text-navy-700 hover:text-navy-900 border border-slate-200 rounded-lg px-2 py-1 transition-colors"
                    >
                      {ocrView === 'table' ? 'View raw JSON' : 'View as table'}
                    </button>
                  </div>
                  {ocrView === 'table' ? (
                    <div className="bg-slate-50 rounded-xl p-3 mt-2 overflow-x-auto">
                      <JsonTable data={candidate.ocrData} />
                    </div>
                  ) : (
                    <pre className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 overflow-x-auto mt-2">{JSON.stringify(candidate.ocrData, null, 2)}</pre>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'scorecard' && (
            <div className="card p-6">
              <div className="flex items-baseline justify-between mb-5">
                <h3 className="font-semibold text-navy-900">Screening scorecard</h3>
                <span className="text-xs text-slate-400">saved automatically</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <label className="label">Communication</label>
                  <select
                    className="input"
                    value={candidate.scorecard?.communication || ''}
                    onChange={(e) => updateScorecard('communication', e.target.value)}
                  >
                    <option value="">Select level</option>
                    {COMMUNICATION_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">Technically Fit</label>
                  <select
                    className="input"
                    value={candidate.scorecard?.technicalFit || ''}
                    onChange={(e) => updateScorecard('technicalFit', e.target.value)}
                  >
                    <option value="">Select level</option>
                    {TECHNICAL_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-6">
                <label className="label mb-2">Department can work for</label>
                <div className="flex flex-wrap gap-2">
                  {DEPARTMENTS.map((dept) => {
                    const active = (candidate.scorecard?.departments || []).includes(dept);
                    return (
                      <button
                        type="button"
                        key={dept}
                        onClick={() => toggleScorecardDepartment(dept)}
                        className={`text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
                          active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        {dept}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 max-w-sm">
                <label className="label">Overall recommendation</label>
                <select className="input" value={candidate.scorecard?.recommendation || ''} onChange={(e) => updateScorecard('recommendation', e.target.value)}>
                  <option value="">Select recommendation</option>
                  {RECOMMENDATIONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
          )}

          {tab === 'communication' && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={18} className="text-emerald-600" />
                <h3 className="font-semibold text-navy-900">AI Communication Center</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GEN_ACTIONS.map((a) => (
                  <button
                    key={a.kind}
                    onClick={() => openGenerator(a.kind)}
                    className="flex items-center gap-3 border border-slate-200 rounded-xl p-4 text-left hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors"
                  >
                    <span className="text-xl">{a.icon}</span>
                    <span className="text-sm font-medium text-navy-800">{a.label}</span>
                  </button>
                ))}
                <button
                  onClick={() => openGenerator('summary')}
                  className="flex items-center gap-3 border border-slate-200 rounded-xl p-4 text-left hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors"
                >
                  <span className="text-xl">🧠</span>
                  <span className="text-sm font-medium text-navy-800">Generate Candidate Summary</span>
                </button>
                <button
                  onClick={() => openGenerator('next_action')}
                  className="flex items-center gap-3 border border-slate-200 rounded-xl p-4 text-left hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors"
                >
                  <span className="text-xl">🎯</span>
                  <span className="text-sm font-medium text-navy-800">Suggested Next Action</span>
                </button>
              </div>
            </div>
          )}

          {tab === 'shares' && (
            <div className="card p-6">
              <h3 className="font-semibold text-navy-900 mb-3">Companies Shared With</h3>
              <div className="space-y-2">
                {(candidate.shares || []).length === 0 && <p className="text-sm text-slate-400">Not shared with any company yet — do this from the Candidate Sharing page.</p>}
                {(candidate.shares || []).map((s) => (
                  <div key={s.id} className="border border-slate-100 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-navy-800">{s.position || 'Position not specified'}</div>
                      <div className="text-xs text-slate-400">Shared {s.dateShared}{s.recruiter ? ` · ${s.recruiter}` : ''}</div>
                    </div>
                    <span className="badge bg-navy-50 text-navy-700">{s.interviewStatus}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'payments' && (
            <div className="card p-6">
              <h3 className="font-semibold text-navy-900 mb-3">Payments</h3>
              <div className="space-y-2">
                {(candidate.payments || []).length === 0 && <p className="text-sm text-slate-400">No payment records for this candidate yet.</p>}
                {(candidate.payments || []).map((p) => (
                  <div key={p.id} className="border border-slate-100 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-navy-800">Invoice {p.invoiceNumber || '—'}</div>
                      <div className="text-xs text-slate-400">₹{Number(p.invoiceAmount || 0).toLocaleString('en-IN')} · received ₹{Number(p.amountReceived || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <span className="badge bg-amber-50 text-amber-700">{p.paymentStatus}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="card p-6">
              <h3 className="font-semibold text-navy-900 mb-3 flex items-center gap-2"><ClipboardList size={18} /> Add a note</h3>
              <div className="flex gap-2 mb-6">
                <input className="input" placeholder="Write a quick note about this candidate…" value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} />
                <button className="btn-emerald shrink-0" onClick={addNote}>Add</button>
              </div>
              <h3 className="font-semibold text-navy-900 mb-3">Timeline</h3>
              <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                {candidate.activities?.length === 0 && <p className="text-sm text-slate-400">No activity yet.</p>}
                {[...(candidate.activities || [])].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))).map((a) => (
                  <div key={a.id} className="border-l-2 border-emerald-200 pl-4 pb-3">
                    <div className="flex items-center gap-2 text-xs text-slate-400">{a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'} {a.pinned && <span className="text-amber-600 font-semibold">Pinned</span>}</div>
                    <div className="text-sm font-medium text-navy-800 capitalize">{(a.type || '').replace(/_/g, ' ')}</div>
                    {a.content && <div className="text-sm text-slate-600 whitespace-pre-wrap mt-1">{a.content}</div>}
                    {a.type === 'note' && <button onClick={() => toggleNotePin(a)} className="mt-1 text-xs text-slate-500 hover:text-emerald-700">{a.pinned ? 'Unpin note' : 'Pin note'}</button>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="✨ AI Generated Message" width="max-w-xl">
        {genLoading ? (
          <div className="text-sm text-slate-400 animate-pulse py-8 text-center">Generating a human-sounding message…</div>
        ) : (
          <>
            <div className="bg-slate-50 rounded-xl p-4 text-sm whitespace-pre-wrap text-navy-900 max-h-96 overflow-y-auto">{genText}</div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-slate-400">{genSource === 'openai' ? 'Generated by OpenAI' : 'Generated using smart template (no OpenAI key configured)'}</span>
              <button onClick={copyText} className="btn-secondary">
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </Layout>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-0.5">{label}</div>
      <div className="text-navy-800 font-medium">{value || '—'}</div>
    </div>
  );
}

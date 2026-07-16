import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';
import { asArray, asObject } from '../utils/safeData';

const TYPE_ICON = {
  Interview: '🎤',
  'Candidate Follow-up': '📞',
  'Joining Date': '🎉',
  'Payment Follow-up': '💰',
};

export default function CalendarPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard/calendar')
      .then((res) => setData(asObject(res.data)))
      .catch(() => setData({}));
  }, []);

  if (!data) return <Layout><div className="animate-pulse text-slate-400">Loading calendar…</div></Layout>;

  const sections = [
    { key: 'missed', label: '⏰ Missed / Overdue', items: asArray(data.missed) },
    { key: 'today', label: '📅 Today', items: asArray(data.today) },
    { key: 'tomorrow', label: '🌤 Tomorrow', items: asArray(data.tomorrow) },
    { key: 'thisWeek', label: '🗓 This Week', items: asArray(data.thisWeek) },
  ];

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Interview & Follow-up Calendar</h1>
        <p className="text-sm text-slate-500 mt-0.5">Interviews, candidate follow-ups, joining dates, and payment follow-ups — all in one place.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((sec) => (
          <div key={sec.key} className="card p-5">
            <h3 className="font-semibold text-navy-900 mb-4">{sec.label} <span className="text-slate-400 font-normal">({sec.items.length})</span></h3>
            {sec.items.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing here.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {sec.items.map((e) => (
                  <Link key={e.id} to={`/candidates/${e.candidateId}`} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span>{TYPE_ICON[e.type] || '📌'}</span>
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-navy-800 truncate">{e.title}</div>
                        <div className="text-xs text-slate-400">{e.type}</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 shrink-0 ml-2">{e.date ? new Date(e.date).toLocaleDateString() : ''}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
}

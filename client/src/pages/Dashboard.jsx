import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import api from '../api/client';

const PIE_COLORS = ['#1f2f4d', '#69d5a0', '#f59e0b', '#f43f5e', '#3b82f6', '#a855f7', '#64748b'];

// Every field on the dashboard stats response is optional-safe: if Firestore
// has zero data (or a field is simply missing from the API response), we
// fall back to 0 / [] instead of letting `undefined.toLocaleString()` (or
// `undefined.length`/`.map`) crash the page after login.
function normalizeStats(raw) {
  const data = raw || {};
  return {
    totalCandidates: data.totalCandidates ?? 0,
    candidatesAddedToday: data.candidatesAddedToday ?? 0,
    candidatesScreened: data.candidatesScreened ?? 0,
    totalCompanies: data.totalCompanies ?? 0,
    candidatesSharedToday: data.candidatesSharedToday ?? 0,
    interviewsScheduled: data.interviewsScheduled ?? 0,
    offers: data.offers ?? 0,
    joined: data.joined ?? 0,
    revenue: Number(data.revenue) || 0,
    pendingPayments: Number(data.pendingPayments) || 0,
    overdueFollowups: data.overdueFollowups ?? 0,
    upcomingFollowups: data.upcomingFollowups ?? 0,
    pipelineSummary: Array.isArray(data.pipelineSummary) ? data.pipelineSummary : [],
    revenueSummary: Array.isArray(data.revenueSummary) ? data.revenueSummary : [],
    recentCandidates: Array.isArray(data.recentCandidates) ? data.recentCandidates : [],
    recentActivity: Array.isArray(data.recentActivity) ? data.recentActivity : [],
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then((res) => setStats(normalizeStats(res.data)))
      .catch(() => setStats(normalizeStats(null)));
  }, []);

  if (!stats) return <Layout><div className="animate-pulse text-slate-400">Loading dashboard…</div></Layout>;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your recruitment pipeline at a glance.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon="🧑‍💼" label="Total Candidates" value={stats.totalCandidates} accent="navy" />
        <StatCard icon="➕" label="Added Today" value={stats.candidatesAddedToday} accent="emerald" />
        <StatCard icon="✅" label="Screened" value={stats.candidatesScreened} accent="emerald" />
        <StatCard icon="🏢" label="Total Companies" value={stats.totalCompanies} accent="navy" />
        <StatCard icon="📤" label="Shared Today" value={stats.candidatesSharedToday} accent="emerald" />
        <StatCard icon="🎤" label="Interviews Scheduled" value={stats.interviewsScheduled} accent="amber" />
        <StatCard icon="🎯" label="Offers Made" value={stats.offers} accent="emerald" />
        <StatCard icon="🎉" label="Joined" value={stats.joined} accent="emerald" />
        <StatCard icon="💰" label="Revenue" value={`₹${(stats.revenue ?? 0).toLocaleString('en-IN')}`} accent="emerald" />
        <StatCard icon="⏳" label="Pending Payments" value={`₹${(stats.pendingPayments ?? 0).toLocaleString('en-IN')}`} accent="rose" />
        <StatCard icon="🔔" label="Upcoming Follow-ups" value={stats.upcomingFollowups} accent="amber" />
        <StatCard icon="⚠️" label="Overdue Follow-ups" value={stats.overdueFollowups} accent="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h3 className="font-semibold text-navy-900 mb-4">Pipeline Summary</h3>
          {stats.pipelineSummary.length === 0 ? (
            <p className="text-sm text-slate-400">No candidates shared yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={stats.pipelineSummary} dataKey="count" nameKey="stage" outerRadius={90} label={(d) => d.stage}>
                  {stats.pipelineSummary.map((entry, i) => (
                    <Cell key={entry.stage} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-navy-900 mb-4">Revenue Summary</h3>
          {stats.revenueSummary.length === 0 ? (
            <p className="text-sm text-slate-400">No payments recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.revenueSummary}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `₹${(Number(v) || 0).toLocaleString('en-IN')}`} />
                <Bar dataKey="total" fill="#69d5a0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-semibold text-navy-900 mb-4">Recent Candidates</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {stats.recentCandidates.length === 0 && <p className="text-sm text-slate-400">No candidates yet.</p>}
            {stats.recentCandidates.map((c) => (
              <Link key={c.id} to={`/candidates/${c.id}`} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100">
                <div>
                  <div className="font-medium text-sm text-navy-800">{c.name}</div>
                  <div className="text-xs text-slate-400">{c.experience} {c.currentCompany ? `· ${c.currentCompany}` : ''}</div>
                </div>
                <span className="badge bg-slate-100 text-slate-600">{c.status}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-navy-900 mb-4">Recent Activity</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {stats.recentActivity.length === 0 && <p className="text-sm text-slate-400">No activity yet.</p>}
            {stats.recentActivity.map((a) => (
              <div key={a.id} className="border-l-2 border-emerald-200 pl-4">
                <div className="text-xs text-slate-400">{a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}</div>
                <div className="text-sm text-navy-800"><Link to={`/candidates/${a.candidateId}`} className="font-medium hover:text-emerald-700">{a.candidateName}</Link> — <span className="capitalize">{(a.type || '').replace(/_/g, ' ')}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

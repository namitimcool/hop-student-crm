// ---------------------------------------------------------------------------
// server/routes/dashboard.js
// Recruitment CRM dashboard metrics + the calendar feed (interviews,
// follow-ups, joining dates, payment follow-ups). Firestore-backed
// replacement for the old activities.js dashboard route.
// ---------------------------------------------------------------------------

const express = require('express');
const { listAll, isSameDay } = require('../utils/firestoreHelpers');

const router = express.Router();

// --- GET /api/dashboard/stats ---
router.get('/stats', async (req, res) => {
  try {
    const [candidates, companies, shares, payments, activities] = await Promise.all([
      listAll('candidates'), listAll('companies'), listAll('candidateShares'),
      listAll('payments'), listAll('activities'),
    ]);

    const totalCandidates = candidates.length;
    const totalCompanies = companies.length;
    const candidatesSharedToday = shares.filter((s) => isSameDay(s.dateShared)).length;
    const interviewsScheduled = shares.filter((s) => s.interviewStatus === 'Interview Scheduled').length;
    const offers = shares.filter((s) => s.interviewStatus === 'Offer Made').length;
    const joined = shares.filter((s) => s.interviewStatus === 'Joined').length;
    const today = new Date().toISOString().slice(0, 10);
    const candidatesAddedToday = candidates.filter((c) => isSameDay(c.createdAt)).length;
    const candidatesScreened = candidates.filter((c) => c.status === 'Screened').length;
    const overdueFollowups = candidates.filter((c) => c.nextFollowUp && String(c.nextFollowUp).slice(0, 10) < today).length;
    const upcomingFollowups = candidates.filter((c) => c.nextFollowUp && String(c.nextFollowUp).slice(0, 10) >= today).length;

    const revenue = payments.reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0);
    const pendingPayments = payments.reduce((sum, p) => sum + (Number(p.pendingAmount) || 0), 0);

    const pipelineCounts = {};
    for (const s of shares) pipelineCounts[s.interviewStatus] = (pipelineCounts[s.interviewStatus] || 0) + 1;
    const pipelineSummary = Object.entries(pipelineCounts).map(([stage, count]) => ({ stage, count }));

    const revenueByMonth = {};
    for (const p of payments) {
      const month = (p.paymentDate || p.invoiceDate || p.createdAt || '').slice(0, 7) || 'Unknown';
      revenueByMonth[month] = (revenueByMonth[month] || 0) + (Number(p.amountReceived) || 0);
    }
    const revenueSummary = Object.entries(revenueByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));

    const recentCandidates = [...candidates]
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 8);

    const recentActivity = [...activities]
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 30)
      .map((a) => {
        const candidate = candidates.find((c) => c.id === a.candidateId);
        return { ...a, candidateName: candidate?.name || 'Unknown Candidate' };
      });

    res.json({
      totalCandidates, totalCompanies, candidatesAddedToday, candidatesScreened, candidatesSharedToday, interviewsScheduled,
      offers, joined, revenue, pendingPayments,
      overdueFollowups, upcomingFollowups,
      pipelineSummary, revenueSummary, recentCandidates, recentActivity,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute dashboard stats: ' + err.message });
  }
});

// --- GET /api/dashboard/calendar ---
// Interview & Follow-up Calendar feed: interview dates, candidate
// follow-ups, joining dates, and payment follow-ups, bucketed by when
// they're due.
router.get('/calendar', async (req, res) => {
  try {
    const [candidates, shares, payments] = await Promise.all([
      listAll('candidates'), listAll('candidateShares'), listAll('payments'),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const candidateMap = Object.fromEntries(candidates.map((c) => [c.id, c]));

    const events = [];

    for (const c of candidates) {
      if (c.nextFollowUp) {
        events.push({
          id: `followup-${c.id}`, date: c.nextFollowUp, type: 'Candidate Follow-up',
          title: c.name, candidateId: c.id,
        });
      }
    }

    for (const s of shares) {
      if (s.interviewDate) {
        events.push({
          id: `interview-${s.id}`, date: s.interviewDate, type: 'Interview',
          title: `${candidateMap[s.candidateId]?.name || 'Candidate'} — ${s.position || 'Interview'}`,
          candidateId: s.candidateId,
        });
      }
      if (s.interviewStatus === 'Joined' && s.joiningDate) {
        events.push({
          id: `joining-${s.id}`, date: s.joiningDate, type: 'Joining Date',
          title: `${candidateMap[s.candidateId]?.name || 'Candidate'} joins`,
          candidateId: s.candidateId,
        });
      }
    }

    for (const p of payments) {
      if (p.pendingAmount > 0 && p.paymentDate) {
        events.push({
          id: `payment-${p.id}`, date: p.paymentDate, type: 'Payment Follow-up',
          title: `₹${(Number(p.pendingAmount) || 0).toLocaleString('en-IN')} pending — ${candidateMap[p.candidateId]?.name || 'Candidate'}`,
          candidateId: p.candidateId,
        });
      }
    }

    const bucket = { missed: [], today: [], tomorrow: [], thisWeek: [] };
    for (const e of events) {
      if (!e.date) continue;
      if (e.date < today) bucket.missed.push(e);
      else if (e.date === today) bucket.today.push(e);
      else if (e.date === tomorrow) bucket.tomorrow.push(e);
      else if (e.date <= weekAhead) bucket.thisWeek.push(e);
    }
    for (const key of Object.keys(bucket)) bucket[key].sort((a, b) => a.date.localeCompare(b.date));

    res.json(bucket);
  } catch (err) {
    res.status(500).json({ error: 'Failed to build calendar: ' + err.message });
  }
});

// --- GET /api/dashboard/recent  (raw activity feed, used outside the dashboard too) ---
router.get('/recent', async (req, res) => {
  try {
    const [activities, candidates] = await Promise.all([listAll('activities'), listAll('candidates')]);
    const candidateMap = Object.fromEntries(candidates.map((c) => [c.id, c]));
    const rows = activities
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 30)
      .map((a) => ({ ...a, candidateName: candidateMap[a.candidateId]?.name || 'Unknown Candidate' }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load recent activity: ' + err.message });
  }
});

module.exports = router;

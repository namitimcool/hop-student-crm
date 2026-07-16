// ---------------------------------------------------------------------------
// server/routes/candidateShares.js
// The core "share this candidate with that company" feature. Each share is
// its own Firestore document — one candidate can have many shares (one per
// company), and one company can have many shared candidates.
// ---------------------------------------------------------------------------

const express = require('express');
const {
  listAll, getById, create, update, remove, findWhere,
} = require('../utils/firestoreHelpers');

const router = express.Router();

const INTERVIEW_STATUSES = [
  'Shared', 'Interview Scheduled', 'Interview Done', 'Offer Made', 'Joined', 'Rejected', 'On Hold',
];

// This literal route must be registered before /:id so Express does not
// interpret "meta" as a share ID.
router.get('/meta/statuses', (req, res) => res.json(INTERVIEW_STATUSES));

// --- GET /api/shares  (optionally ?candidateId= or ?companyId=) ---
router.get('/', async (req, res) => {
  try {
    const { candidateId, companyId } = req.query;
    let rows;
    if (candidateId) rows = await findWhere('candidateShares', 'candidateId', candidateId);
    else if (companyId) rows = await findWhere('candidateShares', 'companyId', companyId);
    else rows = await listAll('candidateShares');

    // Enrich with candidate/company display names so the Kanban board and
    // tables don't need N follow-up requests per card.
    const [candidates, companies] = await Promise.all([listAll('candidates'), listAll('companies')]);
    const candidateMap = Object.fromEntries(candidates.map((c) => [c.id, c]));
    const companyMap = Object.fromEntries(companies.map((c) => [c.id, c]));

    rows = rows.map((r) => ({
      ...r,
      candidateName: candidateMap[r.candidateId]?.name || 'Unknown Candidate',
      companyName: companyMap[r.companyId]?.companyName || 'Unknown Company',
    }));

    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list shares: ' + err.message });
  }
});

// --- GET /api/shares/:id ---
router.get('/:id', async (req, res) => {
  try {
    const share = await getById('candidateShares', req.params.id);
    if (!share) return res.status(404).json({ error: 'Share not found' });
    res.json(share);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load share: ' + err.message });
  }
});

// --- POST /api/shares  (share a candidate with a company) ---
router.post('/', async (req, res) => {
  try {
    const b = req.body;
    if (!b.candidateId || !b.companyId) {
      return res.status(400).json({ error: 'candidateId and companyId are required' });
    }
    const existing = await findWhere('candidateShares', 'candidateId', b.candidateId);
    if (existing.some((s) => s.companyId === b.companyId && s.position === (b.position || ''))) {
      return res.status(409).json({ error: 'This candidate has already been submitted to this company for this position.' });
    }
    const share = await create('candidateShares', {
      candidateId: b.candidateId,
      companyId: b.companyId,
      recruiter: b.recruiter || '',
      position: b.position || '',
      dateShared: b.dateShared || new Date().toISOString().slice(0, 10),
      interviewStatus: b.interviewStatus || 'Shared',
      interviewDate: b.interviewDate || '',
      notes: b.notes || '',
      result: b.result || '', offer: b.offer || '', joiningDate: b.joiningDate || '', remarks: b.remarks || '',
    });

    await create('activities', {
      candidateId: b.candidateId,
      type: 'candidate_shared',
      channel: 'system',
      content: `Shared with a company for the "${b.position || 'open'}" position`,
    });

    res.status(201).json(share);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create share: ' + err.message });
  }
});

// --- PUT /api/shares/:id ---
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['recruiter', 'position', 'dateShared', 'interviewStatus', 'interviewDate', 'notes', 'result', 'offer', 'joiningDate', 'remarks'];
    const patch = {};
    for (const key of allowed) if (key in req.body) patch[key] = req.body[key];
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const existing = await getById('candidateShares', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Share not found' });

    const updated = await update('candidateShares', req.params.id, patch);

    if ('interviewStatus' in patch && patch.interviewStatus !== existing.interviewStatus) {
      await create('activities', {
        candidateId: existing.candidateId,
        type: 'share_status_change',
        channel: 'system',
        content: `Interview status changed from "${existing.interviewStatus}" to "${patch.interviewStatus}"`,
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update share: ' + err.message });
  }
});

// --- DELETE /api/shares/:id ---
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await remove('candidateShares', req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Share not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete share: ' + err.message });
  }
});

module.exports = router;

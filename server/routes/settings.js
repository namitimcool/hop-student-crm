const express = require('express');
const { getById, update } = require('../utils/firestoreHelpers');

const router = express.Router();
const DEFAULT_PIPELINE = ['New', 'CV Reviewed', 'Screening Pending', 'Screened', 'Resume Shared', 'Interview Scheduled', 'Interview 1', 'Interview 2', 'HR Round', 'Technical Round', 'Offer Released', 'Offer Accepted', 'Joined', 'Rejected', 'On Hold', 'Placed'];

router.get('/', async (_req, res) => {
  try {
    const settings = await getById('settings', 'workspace');
    res.json({ pipeline: settings?.pipeline?.length ? settings.pipeline : DEFAULT_PIPELINE });
  } catch (err) { res.status(500).json({ error: 'Failed to load settings: ' + err.message }); }
});

router.put('/', async (req, res) => {
  try {
    const pipeline = Array.isArray(req.body.pipeline) ? [...new Set(req.body.pipeline.map((s) => String(s).trim()).filter(Boolean))] : null;
    if (!pipeline?.length) return res.status(400).json({ error: 'At least one pipeline stage is required.' });
    const existing = await getById('settings', 'workspace');
    if (existing) await update('settings', 'workspace', { pipeline });
    else {
      const { db } = require('../firebase');
      await db.collection('settings').doc('workspace').set({ id: 'workspace', pipeline, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    res.json({ pipeline });
  } catch (err) { res.status(500).json({ error: 'Failed to save settings: ' + err.message }); }
});

module.exports = router;

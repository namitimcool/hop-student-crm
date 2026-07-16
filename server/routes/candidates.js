// ---------------------------------------------------------------------------
// server/routes/candidates.js
// Candidate CRUD + search/filter + photo/resume upload + CSV import/export +
// activity log. Firestore-backed replacement for the old students.js.
// ---------------------------------------------------------------------------

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { stringify } = require('csv-stringify/sync');

const { db } = require('../firebase');
const {
  listAll, getById, create, update, remove,
  findWhere, searchInMemory, filterInMemory, isSameDay, nowIso, FieldValue,
} = require('../utils/firestoreHelpers');
const { importCandidatesFromCsv } = require('../utils/csvImport');
const { extractStudentFromResume } = require('../utils/resumeOcr');
const { uploadResumeToDrive, deleteResumeFromDrive } = require('../utils/googleDrive');

const router = express.Router();

// Kept as data on every candidate so the UI can evolve without any migration.
// Settings can later replace this list per workspace without changing records.
const DEFAULT_PIPELINE = ['New', 'CV Reviewed', 'Screening Pending', 'Screened', 'Resume Shared', 'Interview Scheduled', 'Interview 1', 'Interview 2', 'HR Round', 'Technical Round', 'Offer Released', 'Offer Accepted', 'Joined', 'Rejected', 'On Hold', 'Placed'];

// CSV import needs a real temp file for the streaming csv-parse step, so it
// keeps using disk (auto-deleted right after parsing). Photo/resume uploads
// never need to touch disk at all — they're processed fully in memory and
// nothing is ever written to Firebase Storage (which this project doesn't
// use).
const TMP_DIR = path.join(os.tmpdir(), 'hop-crm-uploads');
fs.mkdirSync(TMP_DIR, { recursive: true });
const upload = multer({ dest: TMP_DIR });
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const MAX_PHOTO_BYTES = 700 * 1024; // small enough to comfortably fit in a Firestore document

const SEARCH_FIELDS = ['name', 'mobile', 'whatsapp', 'email', 'city', 'currentCompany', 'skills'];

function normalizeSkills(skills) {
  if (Array.isArray(skills)) return skills;
  if (typeof skills === 'string') {
    return skills.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// --- GET /api/candidates  (list + search + filters) ---
router.get('/', async (req, res) => {
  try {
    const { q, status, city, experience, currentCompany, skills, department, communication, technicalFit, sourcedFor } = req.query;
    let rows = await listAll('candidates');

    rows = searchInMemory(rows, q, SEARCH_FIELDS);
    rows = filterInMemory(rows, { status, city, experience, currentCompany });

    if (skills) {
      const wanted = String(skills).toLowerCase();
      rows = rows.filter((r) => (r.skills || []).some((s) => s.toLowerCase().includes(wanted)));
    }

    if (department) {
      rows = rows.filter((r) => Array.isArray(r.scorecard?.departments) && r.scorecard.departments.includes(department));
    }
    if (communication) {
      rows = rows.filter((r) => (r.scorecard?.communication || '') === communication);
    }
    if (technicalFit) {
      rows = rows.filter((r) => (r.scorecard?.technicalFit || '') === technicalFit);
    }
    if (sourcedFor) {
      const wanted = String(sourcedFor).toLowerCase();
      rows = rows.filter((r) => String(r.sourcedFor || '').toLowerCase().includes(wanted));
    }

    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list candidates: ' + err.message });
  }
});

// --- GET /api/candidates/meta/sourced-for  (distinct values for filter suggestions) ---
// Must be registered before GET /:id so "meta" isn't swallowed as an id.
router.get('/meta/sourced-for', async (req, res) => {
  try {
    const rows = await listAll('candidates');
    const set = new Set();
    rows.forEach((r) => { if (r.sourcedFor) set.add(r.sourcedFor); });
    res.json([...set].sort((a, b) => a.localeCompare(b)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load sourced-for options: ' + err.message });
  }
});

// --- GET /api/candidates/export/csv ---
router.get('/export/csv', async (req, res) => {
  try {
    const rows = await listAll('candidates');
    const flat = rows.map((r) => ({ ...r, skills: (r.skills || []).join('; ') }));
    const csv = stringify(flat, { header: true });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="hop-candidates-export.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Export failed: ' + err.message });
  }
});

// --- GET /api/candidates/:id ---
router.get('/:id', async (req, res) => {
  try {
    const candidate = await getById('candidates', req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const [activities, documents, shares, payments] = await Promise.all([
      findWhere('activities', 'candidateId', req.params.id),
      findWhere('documents', 'candidateId', req.params.id),
      findWhere('candidateShares', 'candidateId', req.params.id),
      findWhere('payments', 'candidateId', req.params.id),
    ]);

    activities.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    res.json({
      ...candidate,
      activities: Array.isArray(activities) ? activities : [],
      documents: Array.isArray(documents) ? documents : [],
      shares: Array.isArray(shares) ? shares : [],
      payments: Array.isArray(payments) ? payments : [],
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load candidate: ' + err.message });
  }
});

// --- POST /api/candidates  (create manually) ---
router.post('/', async (req, res) => {
  try {
    const b = req.body;
    if (!b.name || (!b.mobile && !b.email)) {
      return res.status(400).json({ error: 'Name and (mobile or email) are required' });
    }
    const candidate = await create('candidates', {
      name: b.name,
      mobile: b.mobile || '',
      whatsapp: b.whatsapp || b.mobile || '',
      email: b.email || '',
      city: b.city || '',
      experience: b.experience || '',
      skills: normalizeSkills(b.skills),
      currentCompany: b.currentCompany || '',
      currentCTC: b.currentCTC || '',
      expectedCTC: b.expectedCTC || '',
      noticePeriod: b.noticePeriod || '',
      notes: b.notes || '',
      sourcedFor: b.sourcedFor || '',
      status: b.status || DEFAULT_PIPELINE[0],
      scorecard: b.scorecard || {},
      lastContact: b.lastContact || '',
      nextFollowUp: b.nextFollowUp || '',
      reminderType: b.reminderType || 'Call',
      resumeText: b.resumeText || '',
      ocrData: b.ocrData || null,
    });
    await create('activities', { candidateId: candidate.id, type: 'candidate_created', channel: 'system', content: 'Candidate created' });
    res.status(201).json(candidate);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create candidate: ' + err.message });
  }
});

// --- PUT /api/candidates/:id ---
router.put('/:id', async (req, res) => {
  try {
    const allowed = [
      'name', 'mobile', 'whatsapp', 'email', 'city', 'experience', 'skills',
      'currentCompany', 'currentCTC', 'expectedCTC', 'noticePeriod', 'notes', 'sourcedFor',
      'status', 'nextFollowUp', 'lastContact', 'reminderType', 'scorecard', 'resumeText', 'photoUrl',
    ];
    const patch = {};
    for (const key of allowed) {
      if (key in req.body) {
        patch[key] = key === 'skills' ? normalizeSkills(req.body[key]) : req.body[key];
      }
    }
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const existing = await getById('candidates', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Candidate not found' });

    const updated = await update('candidates', req.params.id, patch);

    if ('status' in patch && patch.status !== existing.status) {
      await create('activities', {
        candidateId: req.params.id,
        type: 'status_change',
        channel: 'system',
        oldValue: existing.status || '', newValue: patch.status,
        content: `Status changed from "${existing.status || 'New'}" to "${patch.status}"`,
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update candidate: ' + err.message });
  }
});

// --- DELETE /api/candidates/:id ---
router.delete('/:id', async (req, res) => {
  try {
    const candidate = await getById('candidates', req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    if (candidate.driveFileId) {
      try {
        await deleteResumeFromDrive(candidate.driveFileId);
      } catch (driveError) {
        // Deleting the CRM record must not be blocked by a temporary Drive
        // outage. The failed file ID is logged for operational follow-up.
        console.error(`Google Drive delete failed for candidate ${req.params.id}:`, driveError.message);
      }
    }
    const deleted = await remove('candidates', req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Candidate not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete candidate: ' + err.message });
  }
});

// --- POST /api/candidates/import/csv ---
router.post('/import/csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });
  try {
    const result = await importCandidatesFromCsv(req.file.path);
    fs.unlink(req.file.path, () => {});
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to import CSV: ' + err.message });
  }
});

// --- POST /api/candidates/:id/photo ---
// Stored directly inside the Firestore candidate document as a base64
// data URI — no Firebase Storage bucket involved. Capped at MAX_PHOTO_BYTES
// so it comfortably fits inside Firestore's 1MB per-document limit.
router.post('/:id/photo', memoryUpload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });
  if (req.file.size > MAX_PHOTO_BYTES) {
    return res.status(400).json({ error: `Photo is too large (max ${Math.round(MAX_PHOTO_BYTES / 1024)}KB).` });
  }
  try {
    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    await update('candidates', req.params.id, { photoUrl: dataUri });
    res.json({ success: true, photoUrl: dataUri });
  } catch (err) {
    res.status(500).json({ error: 'Photo upload failed: ' + err.message });
  }
});

// --- POST /api/candidates/:id/resume ---
// OCR remains the source of parsed resume data. For PDFs, a Drive copy is
// uploaded in memory and then replaces the prior Drive file.
router.post('/:id/resume', memoryUpload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No resume uploaded' });
  try {
    const existing = await getById('candidates', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Candidate not found' });

    const { rawText } = await extractStudentFromResume(req.file.buffer, req.file.originalname);
    let patch = { resumeText: rawText || '' };
    let driveReplaced = false;

    if (/\.pdf$/i.test(req.file.originalname)) {
      try {
        // Upload first: if Drive fails, the current resume remains available.
        const driveFields = await uploadResumeToDrive({ candidateName: existing.name, phone: existing.mobile, buffer: req.file.buffer });
        patch = { ...patch, ...driveFields };
        driveReplaced = true;
        if (existing.driveFileId) {
          try { await deleteResumeFromDrive(existing.driveFileId); } catch (driveError) { console.error('Old Google Drive resume could not be deleted:', driveError.message); }
        }
      } catch (driveError) {
        console.error('Google Drive replacement upload failed:', driveError.message);
        await create('activities', { candidateId: req.params.id, type: 'resume_drive_upload_failed', channel: 'system', content: 'Resume OCR completed, but Google Drive upload failed. The previous Drive resume was kept.' });
      }
    }

    const updated = await update('candidates', req.params.id, patch);

    await create('activities', {
      candidateId: req.params.id, type: 'resume_attached', channel: 'system',
      content: driveReplaced ? `Resume "${req.file.originalname}" scanned and replaced in Google Drive` : `Resume "${req.file.originalname}" scanned and attached (Drive upload unavailable or non-PDF)`,
    });

    res.status(201).json({ success: true, resumeText: updated.resumeText, driveUploaded: driveReplaced, driveWebViewLink: updated.driveWebViewLink || '' });
  } catch (err) {
    res.status(500).json({ error: 'Resume scan failed: ' + err.message });
  }
});

// --- DELETE /api/candidates/:id/resume ---
// Removes only the Drive resume + its Firestore reference fields. The
// candidate record itself, its resumeText, and OCR data are untouched.
router.delete('/:id/resume', async (req, res) => {
  try {
    const existing = await getById('candidates', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Candidate not found' });
    if (!existing.driveFileId) return res.status(400).json({ error: 'No Drive resume stored for this candidate.' });

    await deleteResumeFromDrive(existing.driveFileId);

    const updated = await update('candidates', req.params.id, {
      driveFileId: FieldValue.delete(),
      driveWebViewLink: FieldValue.delete(),
      driveDownloadLink: FieldValue.delete(),
      resumeFileName: FieldValue.delete(),
      uploadedAt: FieldValue.delete(),
    });

    await create('activities', { candidateId: req.params.id, type: 'resume_deleted', channel: 'system', content: 'Resume removed from Google Drive.' });

    res.json({ success: true, candidate: updated });
  } catch (err) {
    console.error(`Google Drive resume delete failed for candidate ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Failed to delete resume: ' + err.message });
  }
});

// --- POST /api/candidates/:id/activities ---
router.post('/:id/activities', async (req, res) => {
  try {
    const { type, channel, content, pinned } = req.body;
    if (!type) return res.status(400).json({ error: 'Activity type is required' });
    const activity = await create('activities', { candidateId: req.params.id, type, channel: channel || null, content: content || null, pinned: Boolean(pinned) });

    if (['whatsapp', 'email', 'call'].includes(type)) {
      await update('candidates', req.params.id, { lastContact: nowIso() });
    }
    res.status(201).json(activity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to log activity: ' + err.message });
  }
});

// Notes are activity records; keeping the pin on the record makes them durable
// and avoids a second, duplicate notes collection.
router.patch('/:id/activities/:activityId', async (req, res) => {
  try {
    const activity = await getById('activities', req.params.activityId);
    if (!activity || activity.candidateId !== req.params.id) return res.status(404).json({ error: 'Activity not found' });
    const updated = await update('activities', req.params.activityId, { pinned: Boolean(req.body.pinned) });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update activity: ' + err.message });
  }
});

module.exports = router;

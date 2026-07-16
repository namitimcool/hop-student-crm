// ---------------------------------------------------------------------------
// server/routes/resumes.js
// Resume Import (OCR) — no Firebase Storage. Multer keeps the upload in
// memory only (memoryStorage), we send that buffer straight to OCR.space,
// extract structured fields, save the candidate to Firestore, and discard
// the file. Nothing ever touches disk or a Storage bucket.
// ---------------------------------------------------------------------------

const express = require('express');
const multer = require('multer');
const path = require('path');

const { listAll, create, update } = require('../utils/firestoreHelpers');
const { normalizePhone } = require('../utils/csvImport');
const { extractStudentFromResume } = require('../utils/resumeOcr');
const { uploadResumeToDrive } = require('../utils/googleDrive');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per resume
  fileFilter: (req, file, cb) => {
    const ok = /pdf|jpeg|jpg|png|webp/i.test(path.extname(file.originalname));
    cb(ok ? null : new Error('Only PDF, JPG, PNG, or WEBP resume files are supported.'), ok);
  },
});

function buildNotesFromExtraFields(fields) {
  const extras = [];
  if (fields.college) extras.push(`College: ${fields.college}`);
  if (fields.course) extras.push(`Course: ${fields.course}`);
  if (fields.department) extras.push(`Department: ${fields.department}`);
  if (fields.year) extras.push(`Year: ${fields.year}`);
  if (fields.career_goal) extras.push(`Career goal: ${fields.career_goal}`);
  return extras.length ? `Extracted from resume — ${extras.join(' · ')}` : 'Imported automatically via Resume OCR';
}

// --- POST /api/resumes/upload  (field name "resumes", in-memory only) ---
router.post('/upload', upload.array('resumes', 25), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No resume files uploaded.' });
  }

  const existing = await listAll('candidates');
  const results = [];
  const sourcedFor = (req.body.sourcedFor || '').trim();

  for (const file of req.files) {
    try {
      const { fields, source, rawText } = await extractStudentFromResume(file.buffer, file.originalname);

      if (!fields.name) {
        results.push({ filename: file.originalname, status: 'failed', reason: 'Could not detect a candidate name in this resume.', fields });
        continue;
      }
      if (!fields.phone && !fields.email) {
        results.push({ filename: file.originalname, status: 'failed', reason: 'Could not detect a phone number or email in this resume.', fields });
        continue;
      }

      const normalizedPhone = normalizePhone(fields.phone);
      const normalizedEmail = (fields.email || '').toLowerCase();
      const match = existing.find(
        (c) => (normalizedPhone && normalizePhone(c.mobile) === normalizedPhone) ||
               (normalizedEmail && (c.email || '').toLowerCase() === normalizedEmail)
      );

      if (match) {
        results.push({
          filename: file.originalname, status: 'duplicate',
          reason: `Matches existing candidate "${match.name}" (same mobile or email).`,
          matchedCandidateId: match.id, matchedCandidateName: match.name, fields,
        });
        continue;
      }

      const candidate = await create('candidates', {
        name: fields.name,
        mobile: normalizedPhone,
        whatsapp: normalizedPhone,
        email: normalizedEmail,
        city: fields.city || '',
        experience: '',
        skills: [],
        currentCompany: '',
        currentCTC: '',
        expectedCTC: '',
        noticePeriod: '',
        notes: buildNotesFromExtraFields(fields),
        sourcedFor,
        status: 'New',
        resumeText: rawText || '',
        ocrData: fields,
      });

      await create('activities', {
        candidateId: candidate.id, type: 'resume_imported', channel: 'system',
        content: `Candidate created from resume "${file.originalname}" (extracted via automatic offline parsing)`,
      });

      // Drive is intentionally non-blocking: a successful OCR import must
      // never be lost because Drive is unavailable or misconfigured.
      let driveUploaded = false;
      if (/\.pdf$/i.test(file.originalname)) {
        try {
          const driveFields = await uploadResumeToDrive({ candidateName: candidate.name, phone: candidate.mobile, buffer: file.buffer });
          await update('candidates', candidate.id, driveFields);
          driveUploaded = true;
          await create('activities', { candidateId: candidate.id, type: 'resume_uploaded_to_drive', channel: 'system', content: `Resume uploaded to Google Drive as "${driveFields.resumeFileName}"` });
        } catch (driveError) {
          console.error('Google Drive upload failed for imported resume:', driveError.message);
          await create('activities', { candidateId: candidate.id, type: 'resume_drive_upload_failed', channel: 'system', content: 'Resume OCR import completed, but Google Drive upload failed. It can be replaced later.' });
        }
      }

      existing.push(candidate); // keep in-memory dedupe list current for the rest of this batch
      results.push({ filename: file.originalname, status: 'imported', candidateId: candidate.id, fields, source, driveUploaded });
    } catch (err) {
      results.push({ filename: file.originalname, status: 'failed', reason: err.message });
    }
  }

  res.json({
    total: results.length,
    imported: results.filter((r) => r.status === 'imported').length,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    failed: results.filter((r) => r.status === 'failed').length,
    results,
  });
});

module.exports = router;

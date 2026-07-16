// ---------------------------------------------------------------------------
// server/routes/ai.js
// AI Communication Center — same route shape as the original student CRM,
// now generating candidate/recruiter messages via Firestore data.
// ---------------------------------------------------------------------------

const express = require('express');
const { getById, create } = require('../utils/firestoreHelpers');
const { generateMessage } = require('../utils/aiGenerator');

const router = express.Router();

const VALID_KINDS = ['whatsapp', 'email', 'call_script', 'followup', 'meeting_notes', 'summary', 'next_action'];

// --- POST /api/ai/generate/:kind  { candidate_id, log: true/false } ---
router.post('/generate/:kind', async (req, res) => {
  const { kind } = req.params;
  const { candidate_id, log } = req.body;

  if (!VALID_KINDS.includes(kind)) {
    return res.status(400).json({ error: `Invalid kind. Must be one of: ${VALID_KINDS.join(', ')}` });
  }

  try {
    const candidate = await getById('candidates', candidate_id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const result = await generateMessage(kind, candidate);

    if (log) {
      const typeMap = {
        whatsapp: 'whatsapp', email: 'email', call_script: 'call_script_generated',
        followup: 'followup_generated', meeting_notes: 'meeting_notes',
        summary: 'summary_generated', next_action: 'next_action_generated',
      };
      await create('activities', {
        candidateId: candidate_id, type: typeMap[kind] || kind, channel: 'ai', content: result.text,
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'AI generation failed: ' + err.message });
  }
});

module.exports = router;

// ---------------------------------------------------------------------------
// server/routes/companies.js
// Company (client) CRUD + document uploads (Service Agreement, NDA,
// Invoice, Other). Documents are stored as base64 data URIs directly on a
// `documents` Firestore document — there is no Firebase Storage bucket in
// this project, Firestore is the only Firebase service used.
// ---------------------------------------------------------------------------

const express = require('express');
const multer = require('multer');

const {
  listAll, getById, create, update, remove, findWhere, searchInMemory,
} = require('../utils/firestoreHelpers');

const router = express.Router();
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const SEARCH_FIELDS = ['companyName', 'hrName', 'recruiterName', 'email', 'phone', 'website'];
const DOCUMENT_TYPES = ['Service Agreement', 'NDA', 'Invoice', 'Other'];
const MAX_DOCUMENT_BYTES = 900 * 1024; // stays comfortably under Firestore's 1MB per-document limit

// --- GET /api/companies ---
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    let rows = await listAll('companies');
    rows = searchInMemory(rows, q, SEARCH_FIELDS);
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list companies: ' + err.message });
  }
});

// --- GET /api/companies/:id ---
router.get('/:id', async (req, res) => {
  try {
    const company = await getById('companies', req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const [documents, shares, payments, contacts] = await Promise.all([
      findWhere('documents', 'companyId', req.params.id),
      findWhere('candidateShares', 'companyId', req.params.id),
      findWhere('payments', 'companyId', req.params.id),
      findWhere('companyContacts', 'companyId', req.params.id),
    ]);

    res.json({
      ...company,
      documents: Array.isArray(documents) ? documents : [],
      shares: Array.isArray(shares) ? shares : [],
      payments: Array.isArray(payments) ? payments : [],
      contacts: Array.isArray(contacts) ? contacts : [],
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load company: ' + err.message });
  }
});

// --- POST /api/companies ---
router.post('/', async (req, res) => {
  try {
    const b = req.body;
    if (!b.companyName) return res.status(400).json({ error: 'Company name is required' });
    const company = await create('companies', {
      companyName: b.companyName, legalName: b.legalName || '', brandName: b.brandName || '',
      hrName: b.hrName || '',
      recruiterName: b.recruiterName || '',
      phone: b.phone || '',
      email: b.email || '',
      website: b.website || '',
      gst: b.gst || '', pan: b.pan || '', linkedin: b.linkedin || '', industry: b.industry || '',
      address: b.address || '',
      notes: b.notes || '',
      status: b.status || 'Prospect', paymentTerms: b.paymentTerms || '', replacementPeriod: b.replacementPeriod || '',
      creditDays: b.creditDays || '', agreementSigned: Boolean(b.agreementSigned), agreementDate: b.agreementDate || '',
      invoiceRequired: Boolean(b.invoiceRequired), gstPercent: b.gstPercent || '',
    });
    res.status(201).json(company);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create company: ' + err.message });
  }
});

// --- PUT /api/companies/:id ---
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['companyName', 'legalName', 'brandName', 'hrName', 'recruiterName', 'phone', 'email', 'website', 'linkedin', 'gst', 'pan', 'industry', 'address', 'notes', 'status', 'paymentTerms', 'replacementPeriod', 'creditDays', 'agreementSigned', 'agreementDate', 'invoiceRequired', 'gstPercent'];
    const patch = {};
    for (const key of allowed) if (key in req.body) patch[key] = req.body[key];
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const updated = await update('companies', req.params.id, patch);
    if (!updated) return res.status(404).json({ error: 'Company not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update company: ' + err.message });
  }
});

// Contacts are separate records: a client can have HR, recruitment, accounts
// and leadership contacts without continually expanding the company document.
router.post('/:id/contacts', async (req, res) => {
  try {
    const company = await getById('companies', req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const b = req.body;
    if (!b.name) return res.status(400).json({ error: 'Contact name is required' });
    const contact = await create('companyContacts', { companyId: req.params.id, name: b.name, department: b.department || '', designation: b.designation || '', phone: b.phone || '', email: b.email || '', linkedin: b.linkedin || '', birthday: b.birthday || '', preferredCommunication: b.preferredCommunication || 'Call', notes: b.notes || '', primary: Boolean(b.primary) });
    res.status(201).json(contact);
  } catch (err) { res.status(500).json({ error: 'Failed to add contact: ' + err.message }); }
});

// --- DELETE /api/companies/:id ---
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await remove('companies', req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Company not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete company: ' + err.message });
  }
});

// --- POST /api/companies/:id/documents  (type: one of DOCUMENT_TYPES) ---
router.post('/:id/documents', memoryUpload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No document uploaded' });
  if (req.file.size > MAX_DOCUMENT_BYTES) {
    return res.status(400).json({ error: `Document is too large (max ${Math.round(MAX_DOCUMENT_BYTES / 1024)}KB).` });
  }
  try {
    const type = DOCUMENT_TYPES.includes(req.body.type) ? req.body.type : 'Other';
    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const doc = await create('documents', {
      companyId: req.params.id, type, filename: req.file.originalname, url: dataUri,
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Document upload failed: ' + err.message });
  }
});

module.exports = router;

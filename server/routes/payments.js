// ---------------------------------------------------------------------------
// server/routes/payments.js
// Payment tracking per candidate placement. Pending amount is always
// derived (invoiceAmount - amountReceived) rather than trusted from the
// client, so it can never drift out of sync.
// ---------------------------------------------------------------------------

const express = require('express');
const {
  listAll, getById, create, update, remove, findWhere,
} = require('../utils/firestoreHelpers');

const router = express.Router();

function computeDerived(payment) {
  const invoiceAmount = Number(payment.invoiceAmount) || 0;
  const amountReceived = Number(payment.amountReceived) || 0;
  const pendingAmount = Math.max(invoiceAmount - amountReceived, 0);
  let paymentStatus = payment.paymentStatus;
  if (!paymentStatus) {
    if (pendingAmount <= 0 && invoiceAmount > 0) paymentStatus = 'Paid';
    else if (amountReceived > 0) paymentStatus = 'Partial';
    else paymentStatus = 'Pending';
  }
  return { ...payment, invoiceAmount, amountReceived, pendingAmount, paymentStatus };
}

// --- GET /api/payments  (optionally ?candidateId= or ?companyId=) ---
router.get('/', async (req, res) => {
  try {
    const { candidateId, companyId } = req.query;
    let rows;
    if (candidateId) rows = await findWhere('payments', 'candidateId', candidateId);
    else if (companyId) rows = await findWhere('payments', 'companyId', companyId);
    else rows = await listAll('payments');

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
    res.status(500).json({ error: 'Failed to list payments: ' + err.message });
  }
});

// --- POST /api/payments ---
router.post('/', async (req, res) => {
  try {
    const b = req.body;
    if (!b.candidateId || !b.companyId) {
      return res.status(400).json({ error: 'candidateId and companyId are required' });
    }
    const payment = await create('payments', computeDerived({
      candidateId: b.candidateId,
      companyId: b.companyId,
      invoiceNumber: b.invoiceNumber || '',
      invoiceDate: b.invoiceDate || '',
      invoiceAmount: b.invoiceAmount || 0,
      amountReceived: b.amountReceived || 0,
      paymentStatus: b.paymentStatus || '',
      paymentDate: b.paymentDate || '',
      notes: b.notes || '',
    }));
    await create('activities', { candidateId: b.candidateId, type: 'invoice_created', channel: 'system', content: `Invoice ${payment.invoiceNumber || 'record'} created` });
    if (Number(payment.amountReceived) > 0) await create('activities', { candidateId: b.candidateId, type: 'payment_received', channel: 'system', content: `Payment received: ₹${Number(payment.amountReceived).toLocaleString('en-IN')}` });
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create payment: ' + err.message });
  }
});

// --- PUT /api/payments/:id ---
router.put('/:id', async (req, res) => {
  try {
    const existing = await getById('payments', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Payment not found' });

    const allowed = ['invoiceNumber', 'invoiceDate', 'invoiceAmount', 'amountReceived', 'paymentStatus', 'paymentDate', 'notes'];
    const patch = {};
    for (const key of allowed) if (key in req.body) patch[key] = req.body[key];

    const merged = computeDerived({ ...existing, ...patch });
    const updated = await update('payments', req.params.id, merged);
    if ('amountReceived' in patch && Number(merged.amountReceived) > Number(existing.amountReceived || 0)) {
      const received = Number(merged.amountReceived) - Number(existing.amountReceived || 0);
      await create('activities', { candidateId: existing.candidateId, type: 'payment_received', channel: 'system', content: `Payment received: ₹${received.toLocaleString('en-IN')}` });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update payment: ' + err.message });
  }
});

// --- DELETE /api/payments/:id ---
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await remove('payments', req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Payment not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete payment: ' + err.message });
  }
});

module.exports = router;

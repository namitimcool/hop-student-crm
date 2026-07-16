import { useEffect, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import Layout from '../components/Layout';
import PaymentFormModal from '../components/PaymentFormModal';
import api from '../api/client';
import { asArray } from '../utils/safeData';

const STATUS_COLORS = {
  Paid: 'bg-emerald-50 text-emerald-700',
  Partial: 'bg-amber-50 text-amber-700',
  Pending: 'bg-rose-50 text-rose-700',
};

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments');
      setPayments(asArray(res.data));
    } catch (err) {
      console.error('Failed to load payments:', err);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = asArray(payments).reduce((sum, p) => sum + (Number(p?.amountReceived) || 0), 0);
  const totalPending = asArray(payments).reduce((sum, p) => sum + (Number(p?.pendingAmount) || 0), 0);

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Payments</h1>
          <p className="text-sm text-slate-500 mt-0.5">₹{totalRevenue.toLocaleString('en-IN')} received · ₹{totalPending.toLocaleString('en-IN')} pending</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-emerald"><Plus size={16} /> Add Payment</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                <th className="px-5 py-3">Candidate</th>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Invoice Amount</th>
                <th className="px-5 py-3">Received</th>
                <th className="px-5 py-3">Pending</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">Loading…</td></tr>}
              {!loading && payments.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">No payments recorded yet.</td></tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3 font-medium text-navy-800">{p.candidateName}</td>
                  <td className="px-5 py-3 text-slate-600">{p.companyName}</td>
                  <td className="px-5 py-3 text-slate-600">{p.invoiceNumber || '—'}</td>
                  <td className="px-5 py-3 text-slate-600">₹{Number(p.invoiceAmount || 0).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3 text-slate-600">₹{Number(p.amountReceived || 0).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3 text-slate-600">₹{Number(p.pendingAmount || 0).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3"><span className={`badge ${STATUS_COLORS[p.paymentStatus] || 'bg-slate-100 text-slate-600'}`}>{p.paymentStatus}</span></td>
                  <td className="px-5 py-3">
                    <button onClick={() => { setEditing(p); setShowForm(true); }} className="text-xs font-medium text-emerald-700 hover:underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentFormModal open={showForm} onClose={() => setShowForm(false)} onSaved={load} payment={editing} />
    </Layout>
  );
}

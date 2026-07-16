export default function StatCard({ icon, label, value, accent = 'navy', suffix = '' }) {
  const accents = {
    navy: 'bg-navy-50 text-navy-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700'
  };
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${accents[accent] || accents.navy}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-navy-900 truncate">{value}{suffix}</div>
        <div className="text-xs text-slate-500 font-medium truncate">{label}</div>
      </div>
    </div>
  );
}

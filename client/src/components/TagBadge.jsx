const TAG_COLORS = {
  'Hot Candidate': 'bg-rose-50 text-rose-700',
  'Cold Lead': 'bg-slate-100 text-slate-600',
  'High Potential': 'bg-emerald-50 text-emerald-700',
  'Immediately Available': 'bg-navy-50 text-navy-700',
  'Serving Notice': 'bg-amber-50 text-amber-700',
  'Offer Pending': 'bg-orange-50 text-orange-700',
  Placed: 'bg-emerald-100 text-emerald-800',
  'VIP Client': 'bg-purple-50 text-purple-700',
};

export const ALL_TAGS = Object.keys(TAG_COLORS);

export default function TagBadge({ tag }) {
  return (
    <span className={`badge ${TAG_COLORS[tag] || 'bg-slate-100 text-slate-600'}`}>
      {tag}
    </span>
  );
}

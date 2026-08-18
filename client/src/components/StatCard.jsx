const TONE_DOT_STYLES = {
  gray: 'bg-gray-400',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
};

function StatCard({ label, value, tone = 'gray' }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
        <span className={`size-2 rounded-full ${TONE_DOT_STYLES[tone]}`} aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value === null ? '—' : value}</p>
    </div>
  );
}

export default StatCard;

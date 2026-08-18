export const STATUS_STYLES = {
  open: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  closed: 'bg-gray-100 text-gray-600 ring-gray-500/20',
};

export const PRIORITY_STYLES = {
  low: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  medium: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  high: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  urgent: 'bg-red-50 text-red-700 ring-red-600/20',
};

function Badge({ type, value }) {
  const styles = type === 'status' ? STATUS_STYLES : PRIORITY_STYLES;
  const className = styles[value] || 'bg-gray-100 text-gray-600 ring-gray-500/20';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${className}`}
    >
      {value}
    </span>
  );
}

export default Badge;

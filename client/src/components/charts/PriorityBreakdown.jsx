import { useState } from 'react';

const PRIORITY_ORDER = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_COLORS = {
  low: '#9ca3af',
  medium: '#0ea5e9',
  high: '#f97316',
  urgent: '#ef4444',
};

// Single stacked segment bar — reuses this app's existing priority color mapping
// (Badge.jsx) rather than a fresh categorical palette, since priority already
// carries a fixed meaning everywhere else in the UI. A legend keeps identity off
// color alone, and each segment carries its own hover tooltip.
function PriorityBreakdown({ data }) {
  const [activeKey, setActiveKey] = useState(null);
  const byPriority = new Map(data.map((d) => [d.priority, d.ticketsCreated]));
  const total = data.reduce((sum, d) => sum + d.ticketsCreated, 0);

  if (total === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">No data yet</p>;
  }

  return (
    <div>
      <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full">
        {PRIORITY_ORDER.map((priority) => {
          const value = byPriority.get(priority) || 0;
          if (value === 0) return null;
          const pct = (value / total) * 100;
          return (
            <div
              key={priority}
              tabIndex={0}
              className="relative h-full cursor-default first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${pct}%`,
                backgroundColor: PRIORITY_COLORS[priority],
                opacity: activeKey === null || activeKey === priority ? 1 : 0.55,
              }}
              onMouseEnter={() => setActiveKey(priority)}
              onMouseLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(priority)}
              onBlur={() => setActiveKey(null)}
            >
              {activeKey === priority && (
                <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs capitalize shadow-md">
                  <span className="font-semibold text-gray-900">{value}</span>{' '}
                  <span className="text-gray-500">{priority}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {PRIORITY_ORDER.map((priority) => (
          <div key={priority} className="flex items-center gap-1.5 text-xs capitalize text-gray-600">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: PRIORITY_COLORS[priority] }}
              aria-hidden="true"
            />
            {priority}
            <span className="font-medium text-gray-900">{byPriority.get(priority) || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PriorityBreakdown;

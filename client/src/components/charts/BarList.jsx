import { useState } from 'react';

// Horizontal single-series bar list. One flat color (identity is the row label,
// not a per-bar hue) with a per-bar hover/focus tooltip and a direct value label
// that moves outside the bar when there isn't room to fit inside it.
function BarList({ data, color = '#4f46e5', emptyLabel = 'No data yet' }) {
  const [activeIndex, setActiveIndex] = useState(null);

  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">{emptyLabel}</p>;
  }

  const maxValue = Math.max(1, ...data.map((d) => d.value));

  return (
    <ul className="flex flex-col gap-3">
      {data.map((row, i) => {
        const pct = (row.value / maxValue) * 100;
        const labelFitsInside = pct > 22;
        return (
          <li key={row.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="truncate font-medium text-gray-700">{row.label}</span>
              {!labelFitsInside && <span className="ml-2 shrink-0 text-gray-500">{row.value}</span>}
            </div>
            <div
              className="relative h-4 w-full cursor-default rounded-full bg-gray-100"
              tabIndex={0}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex(null)}
            >
              <div
                className="flex h-4 items-center justify-end rounded-full pr-2 transition-opacity"
                style={{
                  width: `${Math.max(pct, 3)}%`,
                  backgroundColor: color,
                  opacity: activeIndex === null || activeIndex === i ? 1 : 0.55,
                }}
              >
                {labelFitsInside && <span className="text-[10px] font-semibold text-white">{row.value}</span>}
              </div>
              {activeIndex === i && (
                <div className="pointer-events-none absolute -top-8 left-0 z-10 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-md">
                  <span className="font-semibold text-gray-900">{row.value}</span>{' '}
                  <span className="text-gray-500">{row.label}</span>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default BarList;

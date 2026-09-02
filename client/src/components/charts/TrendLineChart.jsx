import { useRef, useState } from 'react';

const WIDTH = 640;
const HEIGHT = 240;
const PAD_LEFT = 36;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

function niceMax(value) {
  if (value <= 0) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const residual = value / magnitude;
  let step;
  if (residual <= 1) step = 1;
  else if (residual <= 2) step = 2;
  else if (residual <= 5) step = 5;
  else step = 10;
  return step * magnitude;
}

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// Two-series daily trend (tickets created vs. resolved) with a crosshair + shared
// tooltip. Values live at the line's end (direct label) and in the tooltip; color
// never carries identity alone — a legend with line-keys is always shown alongside.
function TrendLineChart({ data, series }) {
  const svgRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const maxRaw = Math.max(1, ...series.flatMap((s) => data.map((d) => d[s.key])));
  const maxValue = niceMax(maxRaw);

  const xAt = (i) => PAD_LEFT + (data.length <= 1 ? 0 : (i / (data.length - 1)) * plotWidth);
  const yAt = (v) => PAD_TOP + plotHeight - (v / maxValue) * plotHeight;

  const paths = series.map((s) => ({
    ...s,
    d: data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(d[s.key])}`).join(' '),
  }));

  const gridTicks = [0, 0.5, 1].map((f) => Math.round(maxValue * f));
  const labelStep = Math.max(1, Math.ceil(data.length / 6));

  function handlePointerMove(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const localX = (e.clientX - rect.left) * scaleX;
    const ratio = (localX - PAD_LEFT) / plotWidth;
    const index = Math.round(ratio * (data.length - 1));
    setHoverIndex(Math.min(data.length - 1, Math.max(0, index)));
  }

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const endLabelsCollide =
    series.length === 2 &&
    Math.abs(yAt(data[data.length - 1][series[0].key]) - yAt(data[data.length - 1][series[1].key])) < 14;

  return (
    <div>
      <div className="mb-3 flex items-center gap-4">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
          tabIndex={0}
          role="img"
          aria-label="Tickets created vs. resolved trend"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setHoverIndex((i) => Math.min(data.length - 1, (i ?? 0) + 1));
            if (e.key === 'ArrowLeft') setHoverIndex((i) => Math.max(0, (i ?? 0) - 1));
          }}
        >
          {gridTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={yAt(tick)}
                y2={yAt(tick)}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text x={PAD_LEFT - 8} y={yAt(tick)} textAnchor="end" dominantBaseline="middle" className="fill-gray-400 text-[10px]">
                {tick.toLocaleString()}
              </text>
            </g>
          ))}

          {data.map((d, i) =>
            i % labelStep === 0 ? (
              <text
                key={d.date}
                x={xAt(i)}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-gray-400 text-[10px]"
              >
                {formatDate(d.date)}
              </text>
            ) : null,
          )}

          {paths.map((s) => (
            <path key={s.key} d={s.d} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          ))}

          {series.map((s, si) => {
            const last = data[data.length - 1];
            const showLabel = !endLabelsCollide || si === 0;
            return (
              <g key={s.key}>
                <circle cx={xAt(data.length - 1)} cy={yAt(last[s.key])} r="4" fill={s.color} stroke="#fff" strokeWidth="2" />
                {showLabel && (
                  <text
                    x={xAt(data.length - 1) + 6}
                    y={yAt(last[s.key])}
                    dominantBaseline="middle"
                    className="fill-gray-700 text-[10px] font-medium"
                  >
                    {last[s.key]}
                  </text>
                )}
              </g>
            );
          })}

          {hovered && (
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={PAD_TOP}
              y2={HEIGHT - PAD_BOTTOM}
              stroke="#9ca3af"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}
          {hovered &&
            series.map((s) => (
              <circle
                key={s.key}
                cx={xAt(hoverIndex)}
                cy={yAt(hovered[s.key])}
                r="4"
                fill={s.color}
                stroke="#fff"
                strokeWidth="2"
              />
            ))}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md"
            style={{
              left: `${Math.min(85, Math.max(5, (xAt(hoverIndex) / WIDTH) * 100))}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <p className="mb-1 font-medium text-gray-900">{formatDate(hovered.date)}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center gap-1.5 text-gray-600">
                <span className="inline-block h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="font-semibold text-gray-900">{hovered[s.key]}</span> {s.label}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TrendLineChart;

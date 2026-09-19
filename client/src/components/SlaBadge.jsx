const STATE_STYLES = {
  met: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  pending: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  at_risk: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  breached: 'bg-red-50 text-red-700 ring-red-600/20',
};

const STATE_LABELS = {
  met: 'SLA met',
  pending: 'SLA on track',
  at_risk: 'SLA at risk',
  breached: 'SLA breached',
};

// Shape as well as colour, so the state does not depend on colour alone.
const STATE_MARKS = {
  met: '✓',
  pending: '•',
  at_risk: '!',
  breached: '×',
};

function formatDelta(due) {
  const ms = new Date(due) - new Date();
  const abs = Math.abs(ms);
  const minutes = Math.round(abs / 60_000);

  let value;
  if (minutes < 60) {
    value = `${minutes}m`;
  } else if (minutes < 60 * 24) {
    value = `${Math.round(minutes / 60)}h`;
  } else {
    value = `${Math.round(minutes / (60 * 24))}d`;
  }

  return ms >= 0 ? `${value} left` : `${value} over`;
}

// `sla` is null when the org has no policy for that priority, which is not an
// error worth showing - it just means nothing is being measured.
function SlaBadge({ sla, showDetail = false }) {
  if (!sla) return null;

  const { state, firstResponse, resolution } = sla;
  const running = resolution.state === 'pending' || resolution.state === 'at_risk';

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span
        title={
          firstResponse.state === 'breached'
            ? 'First reply missed its target'
            : `First reply target ${new Date(firstResponse.dueAt).toLocaleString()}`
        }
        className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATE_STYLES[state]}`}
      >
        <span aria-hidden="true">{STATE_MARKS[state]}</span>
        {STATE_LABELS[state]}
      </span>
      {showDetail && running && (
        <span className="text-xs text-gray-500">Resolve by {formatDelta(resolution.dueAt)}</span>
      )}
    </span>
  );
}

export default SlaBadge;

import { useEffect, useState } from 'react';
import { listSlaPolicies, updateSlaPolicy } from '../api/sla';
import { useAuth } from '../context/AuthContext';
import Badge from './Badge';
import { cardClass, primaryButtonClass, secondaryButtonClass } from '../lib/ui';

// Minutes are what the API stores, but nobody thinks in "1440 minutes", so
// each target is edited as a number and a unit and turned back into minutes
// only when saved.
const UNITS = [
  { key: 'min', label: 'minutes', one: 'minute', minutes: 1 },
  { key: 'h', label: 'hours', one: 'hour', minutes: 60 },
  { key: 'd', label: 'days', one: 'day', minutes: 60 * 24 },
];
const MAX_MINUTES = 60 * 24 * 365;

// The largest unit the stored minutes divide into evenly: 1440 reads as 1 day,
// 90 as 90 minutes rather than 1.5 hours.
function toDuration(minutes) {
  const unit = [...UNITS].reverse().find((u) => minutes % u.minutes === 0) || UNITS[0];
  return { amount: String(minutes / unit.minutes), unit: unit.key };
}

function toMinutes({ amount, unit }) {
  const value = Number(amount);
  if (!amount.trim() || !Number.isFinite(value)) return null;
  return Math.round(value * UNITS.find((u) => u.key === unit).minutes);
}

function describe(minutes) {
  if (!minutes) return '';
  const { amount, unit } = toDuration(minutes);
  const u = UNITS.find((x) => x.key === unit);
  return `${amount} ${amount === '1' ? u.one : u.label}`;
}

// Why a row cannot be saved as it stands, or null.
function rowProblem(firstReply, resolve) {
  if (firstReply === null || resolve === null) return 'Enter a number for both targets.';
  if (firstReply < 1 || resolve < 1) return 'Targets must be at least 1 minute.';
  if (firstReply > MAX_MINUTES || resolve > MAX_MINUTES) return 'Targets can be at most 365 days.';
  if (resolve < firstReply) return 'Resolving cannot take less time than the first reply.';
  return null;
}

function DurationInput({ label, value, disabled, invalid, onChange }) {
  return (
    <div
      className={`flex w-44 overflow-hidden rounded-lg border bg-white shadow-sm transition focus-within:ring-2 ${
        invalid
          ? 'border-red-400 focus-within:ring-red-500/30'
          : 'border-gray-300 focus-within:border-indigo-500 focus-within:ring-indigo-500/30'
      }`}
    >
      <input
        aria-label={`${label} amount`}
        inputMode="decimal"
        value={value.amount}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, amount: e.target.value })}
        className="w-full min-w-0 bg-transparent px-3 py-2 text-sm text-gray-900 focus:outline-none disabled:opacity-60"
      />
      <select
        aria-label={`${label} unit`}
        value={value.unit}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, unit: e.target.value })}
        className="border-l border-gray-200 bg-gray-50 px-2 text-sm text-gray-600 focus:outline-none disabled:opacity-60"
      >
        {UNITS.map((u) => (
          <option key={u.key} value={u.key}>
            {u.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function draftsFrom(policies) {
  return Object.fromEntries(
    policies.map((p) => [
      p.id,
      { firstReply: toDuration(p.first_response_minutes), resolve: toDuration(p.resolution_minutes) },
    ]),
  );
}

function SlaSection() {
  const { token, agent } = useAuth();
  const isAdmin = agent?.role === 'admin';

  const [policies, setPolicies] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    listSlaPolicies(token)
      .then((result) => {
        if (cancelled) return;
        setPolicies(result.policies);
        setDrafts(draftsFrom(result.policies));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const rows = policies.map((policy) => {
    const draft = drafts[policy.id];
    const firstReply = draft ? toMinutes(draft.firstReply) : policy.first_response_minutes;
    const resolve = draft ? toMinutes(draft.resolve) : policy.resolution_minutes;
    return {
      policy,
      draft,
      firstReply,
      resolve,
      problem: rowProblem(firstReply, resolve),
      changed: firstReply !== policy.first_response_minutes || resolve !== policy.resolution_minutes,
    };
  });
  const changed = rows.filter((r) => r.changed);
  const blocked = changed.some((r) => r.problem);

  const setDraft = (id, field, value) => {
    setSuccess('');
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const saved = [];
      for (const row of changed) {
        saved.push(
          await updateSlaPolicy(token, row.policy.id, {
            firstResponseMinutes: row.firstReply,
            resolutionMinutes: row.resolve,
          }),
        );
      }
      const next = policies.map((p) => saved.find((s) => s.id === p.id) || p);
      setPolicies(next);
      setDrafts(draftsFrom(next));
      setSuccess(saved.length === 1 ? 'Target saved' : `${saved.length} targets saved`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${cardClass} mb-8 p-5`}>
      <h2 className="text-base font-semibold text-gray-900">SLA targets</h2>
      <p className="mt-0.5 mb-4 text-sm text-gray-500">
        How long this organization gives itself to reply first and to resolve, per priority. A ticket is flagged
        at risk once three quarters of a target has passed.
      </p>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!isAdmin && <p className="mb-3 text-sm text-gray-500">Only an admin can change these targets.</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-8 font-medium">Priority</th>
                  <th className="pb-2 pr-6 font-medium">First reply within</th>
                  <th className="pb-2 font-medium">Resolve within</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ policy, draft, firstReply, resolve, problem, changed: rowChanged }) => (
                  <tr key={policy.id} className="border-b border-gray-100 align-top last:border-0">
                    <td className="py-3 pr-8 pt-5">
                      <Badge type="priority" value={policy.priority} />
                    </td>
                    <td className="py-3 pr-6">
                      {draft && (
                        <DurationInput
                          label={`${policy.priority} first reply`}
                          value={draft.firstReply}
                          disabled={!isAdmin || saving}
                          invalid={rowChanged && Boolean(problem)}
                          onChange={(value) => setDraft(policy.id, 'firstReply', value)}
                        />
                      )}
                    </td>
                    <td className="py-3">
                      {draft && (
                        <DurationInput
                          label={`${policy.priority} resolve`}
                          value={draft.resolve}
                          disabled={!isAdmin || saving}
                          invalid={rowChanged && Boolean(problem)}
                          onChange={(value) => setDraft(policy.id, 'resolve', value)}
                        />
                      )}
                    </td>
                    <td className="py-3 pl-6 pt-5 text-xs">
                      {rowChanged && problem ? (
                        <span className="text-red-600">{problem}</span>
                      ) : (
                        <span className="text-gray-400">
                          Reply within {describe(firstReply)}, resolve within {describe(resolve)}
                          {rowChanged && <span className="ml-1.5 font-medium text-indigo-600">· unsaved</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isAdmin && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={primaryButtonClass}
                disabled={saving || changed.length === 0 || blocked}
                onClick={handleSave}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {changed.length > 0 && !saving && (
                <button type="button" className={secondaryButtonClass} onClick={() => setDrafts(draftsFrom(policies))}>
                  Discard
                </button>
              )}
              {success && <span className="text-sm text-emerald-600">{success}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SlaSection;

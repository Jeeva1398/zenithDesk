import { useEffect, useState } from 'react';
import { listSlaPolicies, updateSlaPolicy } from '../api/sla';
import { useAuth } from '../context/AuthContext';
import Badge from './Badge';
import { cardClass, inputClass, primaryButtonClass } from '../lib/ui';

// Minutes are what the API stores, but nobody thinks in "1440 minutes", so the
// row shows the friendlier unit next to the field it is derived from.
function humanize(minutes) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) {
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
  }
  const days = minutes / (60 * 24);
  return `${Number.isInteger(days) ? days : days.toFixed(1)} d`;
}

function SlaSection() {
  const { token, agent } = useAuth();
  const isAdmin = agent?.role === 'admin';

  const [policies, setPolicies] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const result = await listSlaPolicies(token);
      setPolicies(result.policies);
      setDrafts(
        Object.fromEntries(
          result.policies.map((p) => [
            p.id,
            {
              firstResponseMinutes: String(p.first_response_minutes),
              resolutionMinutes: String(p.resolution_minutes),
            },
          ]),
        ),
      );
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (policy) => {
    setSavingId(policy.id);
    setError('');
    setSuccess('');
    try {
      const draft = drafts[policy.id];
      const updated = await updateSlaPolicy(token, policy.id, {
        firstResponseMinutes: Number(draft.firstResponseMinutes),
        resolutionMinutes: Number(draft.resolutionMinutes),
      });
      setPolicies((current) => current.map((p) => (p.id === updated.id ? updated : p)));
      setSuccess(`${policy.priority} targets saved`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const setDraft = (id, field, value) =>
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));

  return (
    <div className={`${cardClass} mb-8 p-5`}>
      <h2 className="text-base font-semibold text-gray-900">SLA targets</h2>
      <p className="mt-0.5 mb-4 text-sm text-gray-500">
        How long this organization gives itself to reply first and to resolve, per priority. A
        ticket is flagged at risk once three quarters of a target has passed.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mb-3 text-sm text-emerald-600">{success}</p>}
      {!isAdmin && (
        <p className="mb-3 text-sm text-gray-500">Only an admin can change these targets.</p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
              <th className="pb-2 font-medium">Priority</th>
              <th className="pb-2 font-medium">First reply (min)</th>
              <th className="pb-2 font-medium">Resolve (min)</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => (
              <tr key={policy.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2.5">
                  <Badge type="priority" value={policy.priority} />
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      aria-label={`${policy.priority} first reply minutes`}
                      className={`${inputClass} w-28`}
                      value={drafts[policy.id]?.firstResponseMinutes ?? ''}
                      disabled={!isAdmin}
                      onChange={(e) => setDraft(policy.id, 'firstResponseMinutes', e.target.value)}
                    />
                    <span className="text-xs text-gray-400">
                      {humanize(policy.first_response_minutes)}
                    </span>
                  </div>
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      aria-label={`${policy.priority} resolution minutes`}
                      className={`${inputClass} w-28`}
                      value={drafts[policy.id]?.resolutionMinutes ?? ''}
                      disabled={!isAdmin}
                      onChange={(e) => setDraft(policy.id, 'resolutionMinutes', e.target.value)}
                    />
                    <span className="text-xs text-gray-400">
                      {humanize(policy.resolution_minutes)}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 text-right">
                  {isAdmin && (
                    <button
                      type="button"
                      className={primaryButtonClass}
                      disabled={savingId === policy.id}
                      onClick={() => handleSave(policy)}
                    >
                      {savingId === policy.id ? 'Saving...' : 'Save'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default SlaSection;

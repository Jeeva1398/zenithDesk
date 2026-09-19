import { useEffect, useState } from 'react';
import { createMacro, deleteMacro, listMacros, updateMacro } from '../api/macros';
import { listAgents } from '../api/agents';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../lib/ui';

const STATUSES = ['open', 'pending', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const emptyForm = { name: '', status: '', priority: '', assignedAgentId: '', comment: '' };

// The form holds every action as a string so the blank option can mean "leave
// this field alone". Only the fields actually set are sent, which is what lets a
// macro change a status without also blanking the assignee.
function toActions(form) {
  const actions = {};
  if (form.status) actions.status = form.status;
  if (form.priority) actions.priority = form.priority;
  if (form.assignedAgentId) actions.assignedAgentId = Number(form.assignedAgentId);
  if (form.comment.trim()) actions.comment = form.comment.trim();
  return actions;
}

function fromActions(macro) {
  const actions = macro.actions || {};
  return {
    name: macro.name,
    status: actions.status || '',
    priority: actions.priority || '',
    assignedAgentId: actions.assignedAgentId ? String(actions.assignedAgentId) : '',
    comment: actions.comment || '',
  };
}

function summarize(actions, agents) {
  const parts = [];
  if (actions.status) parts.push(`status to ${actions.status}`);
  if (actions.priority) parts.push(`priority to ${actions.priority}`);
  if (actions.assignedAgentId) {
    const agent = agents.find((a) => a.id === actions.assignedAgentId);
    parts.push(`assign to ${agent ? agent.name : `agent #${actions.assignedAgentId}`}`);
  }
  if (actions.comment) parts.push('adds a reply');
  return parts.join(' - ');
}

function MacrosSection() {
  const { token } = useAuth();
  const [macros, setMacros] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await listMacros(token);
      setMacros(result.macros);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    listAgents(token)
      .then((result) => setAgents(result.agents))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing('new');
    setForm(emptyForm);
    setFormError('');
  };

  const openEdit = (macro) => {
    setEditing(macro);
    setForm(fromActions(macro));
    setFormError('');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = { name: form.name, actions: toActions(form) };
      if (editing === 'new') {
        await createMacro(token, payload);
      } else {
        await updateMacro(token, editing.id, payload);
      }
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (macro) => {
    setDeletingId(macro.id);
    setError('');
    try {
      await deleteMacro(token, macro.id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={`${cardClass} mb-8 p-5`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Macros</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            One-click bundles of the edits you make over and over on a ticket
          </p>
        </div>
        <button type="button" className={primaryButtonClass} onClick={openCreate}>
          New macro
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : macros.length === 0 ? (
        <p className="text-sm text-gray-500">
          No macros yet. Create one to apply a status, priority, assignee and reply in a single
          click.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Does</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {macros.map((macro) => (
              <tr key={macro.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2.5 font-medium text-gray-900">{macro.name}</td>
                <td className="py-2.5 text-gray-500">{summarize(macro.actions, agents)}</td>
                <td className="py-2.5 text-right">
                  <button
                    type="button"
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                    onClick={() => openEdit(macro)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === macro.id}
                    className="ml-4 text-sm font-medium text-red-600 hover:text-red-500 disabled:opacity-50"
                    onClick={() => handleDelete(macro)}
                  >
                    {deletingId === macro.id ? 'Deleting...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal renders whenever it is mounted - it has no `open` prop - so the
          caller is what decides visibility. */}
      {editing !== null && (
        <Modal
          onClose={() => setEditing(null)}
          title={editing === 'new' ? 'New macro' : 'Edit macro'}
        >
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div>
              <label className={labelClass} htmlFor="macro-name">
                Name
              </label>
              <input
                id="macro-name"
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Close as resolved"
              />
            </div>

            <p className="text-sm text-gray-500">
              Leave a field blank to leave it untouched. A macro needs at least one action.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="macro-status">
                  Status
                </label>
                <select
                  id="macro-status"
                  className={inputClass}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="">Leave unchanged</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="macro-priority">
                  Priority
                </label>
                <select
                  id="macro-priority"
                  className={inputClass}
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="">Leave unchanged</option>
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="macro-assignee">
                Assignee
              </label>
              <select
                id="macro-assignee"
                className={inputClass}
                value={form.assignedAgentId}
                onChange={(e) => setForm({ ...form, assignedAgentId: e.target.value })}
              >
                <option value="">Leave unchanged</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="macro-comment">
                Reply to post
              </label>
              <textarea
                id="macro-comment"
                rows={3}
                className={inputClass}
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Thanks for getting in touch - this is now resolved."
              />
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button type="submit" className={primaryButtonClass} disabled={saving}>
                {saving ? 'Saving...' : 'Save macro'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default MacrosSection;

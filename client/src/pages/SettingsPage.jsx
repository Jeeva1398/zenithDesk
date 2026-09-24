import { useEffect, useState } from 'react';
import {
  changeMyPassword,
  createAgent,
  deleteAgent,
  listAgents,
  updateAgent,
  updateMyProfile,
} from '../api/agents';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import MacrosSection from '../components/MacrosSection';
import SlaSection from '../components/SlaSection';
import ChatWidgetSection from '../components/ChatWidgetSection';
import { cardClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../lib/ui';

const ROLES = ['agent', 'admin'];
const emptyInviteForm = { name: '', email: '', password: '', role: 'agent' };
const emptyPasswordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

function ProfileSection() {
  const { agent, token, updateAgent: updateAuthAgent } = useAuth();
  const [form, setForm] = useState({ name: agent?.name || '', email: agent?.email || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const updated = await updateMyProfile(token, form);
      updateAuthAgent({ name: updated.name, email: updated.email });
      setSuccess('Profile updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${cardClass} mb-8 p-5`}>
      <h2 className="mb-4 text-base font-semibold text-gray-900">Your profile</h2>
      <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            className={inputClass}
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {success && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
    </div>
  );
}

function PasswordSection() {
  const { token } = useAuth();
  const [form, setForm] = useState(emptyPasswordForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSaving(true);
    try {
      await changeMyPassword(token, {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm(emptyPasswordForm);
      setSuccess('Password changed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${cardClass} mb-8 p-5`}>
      <h2 className="mb-4 text-base font-semibold text-gray-900">Change password</h2>
      <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
        <div>
          <label className={labelClass}>Current password</label>
          <input
            type="password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>New password</label>
          <input
            type="password"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            required
            minLength={8}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Confirm new password</label>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            required
            minLength={8}
            className={inputClass}
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {success && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  );
}

function AgentsSection() {
  const { agent: currentAgent, token } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);

  const [editingAgent, setEditingAgent] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'agent' });
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const [rowError, setRowError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const loadAgents = () => {
    setLoading(true);
    listAgents(token)
      .then((data) => setAgents(data.agents))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadAgents, [token]);

  const closeInvite = () => {
    setShowInvite(false);
    setInviteForm(emptyInviteForm);
    setInviteError('');
  };

  const handleInviteSubmit = async (event) => {
    event.preventDefault();
    setInviteError('');
    setInviting(true);
    try {
      await createAgent(token, inviteForm);
      closeInvite();
      loadAgents();
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const openEdit = (a) => {
    setEditingAgent(a);
    setEditForm({ name: a.name, email: a.email, role: a.role });
    setEditError('');
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setEditError('');
    setSaving(true);
    try {
      await updateAgent(token, editingAgent.id, editForm);
      setEditingAgent(null);
      loadAgents();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a) => {
    if (!window.confirm(`Remove ${a.name} from this organization?`)) {
      return;
    }
    setRowError('');
    setDeletingId(a.id);
    try {
      await deleteAgent(token, a.id);
      loadAgents();
    } catch (err) {
      setRowError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Agents</h2>
        {currentAgent?.role === 'admin' && (
          <button type="button" onClick={() => setShowInvite(true)} className={primaryButtonClass}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Invite agent
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      )}

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {rowError && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{rowError}</p>}

      {!loading && agents.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                {currentAgent?.role === 'admin' && <th className="px-5 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agents.map((a) => {
                const isSelf = a.id === currentAgent?.id;
                return (
                  <tr key={a.id} className="transition hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      {a.name} {isSelf && <span className="text-xs font-normal text-gray-400">(you)</span>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{a.email}</td>
                    <td className="px-5 py-3.5 capitalize text-gray-600">{a.role}</td>
                    {currentAgent?.role === 'admin' && (
                      <td className="px-5 py-3.5">
                        {isSelf ? (
                          <span className="text-xs text-gray-400">Use &quot;Your profile&quot; above</span>
                        ) : (
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => openEdit(a)}
                              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(a)}
                              disabled={deletingId === a.id}
                              className="text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingId === a.id ? 'Removing…' : 'Remove'}
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showInvite && (
        <Modal title="Invite agent" onClose={closeInvite}>
          <form onSubmit={handleInviteSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Name</label>
              <input
                type="text"
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Temporary password</label>
              <input
                type="password"
                value={inviteForm.password}
                onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <select
                value={inviteForm.role}
                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                className={`${inputClass} capitalize`}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r} className="capitalize">
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {inviteError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{inviteError}</p>
            )}

            <div className="mt-1 flex justify-end gap-3">
              <button type="button" onClick={closeInvite} className={secondaryButtonClass}>
                Cancel
              </button>
              <button type="submit" disabled={inviting} className={primaryButtonClass}>
                {inviting ? 'Inviting…' : 'Invite agent'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingAgent && (
        <Modal title={`Edit ${editingAgent.name}`} onClose={() => setEditingAgent(null)}>
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className={`${inputClass} capitalize`}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r} className="capitalize">
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {editError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</p>
            )}

            <div className="mt-1 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingAgent(null)} className={secondaryButtonClass}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={primaryButtonClass}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SettingsPage() {
  const { agent } = useAuth();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Organization and team management</p>
      </div>

      <div className={`${cardClass} mb-8 p-5`}>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Organization</p>
        <p className="mt-1 text-base font-semibold text-gray-900">
          {agent?.orgName || 'Your organization'}
        </p>
      </div>

      <ProfileSection />
      <PasswordSection />
      <AgentsSection />
      <MacrosSection />
      <SlaSection />
      <ChatWidgetSection />
    </div>
  );
}

export default SettingsPage;

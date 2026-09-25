import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import BotPurposeSection from '../components/BotPurposeSection';
import KnowledgeSection from '../components/KnowledgeSection';
import PasswordInput from '../components/PasswordInput';
import {
  cardClass,
  inputClass,
  labelClass,
  navItemActiveClass,
  navItemClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../lib/ui';

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
          <PasswordInput
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>New password</label>
          <PasswordInput
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            required
            minLength={8}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Confirm new password</label>
          <PasswordInput
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
                          <span className="text-xs text-gray-400">Edit yourself in the Profile tab</span>
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
              <PasswordInput
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

const TABS = [
  {
    key: 'profile',
    label: 'Profile',
    description: 'Your name, email and password',
    icon: 'M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z',
    render: () => (
      <>
        <ProfileSection />
        <PasswordSection />
      </>
    ),
  },
  {
    key: 'team',
    label: 'Team',
    description: 'Agents and their roles',
    icon: 'M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z',
    render: () => <AgentsSection />,
  },
  {
    key: 'macros',
    label: 'Macros',
    description: 'Canned replies and bulk actions',
    icon: 'M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z',
    render: () => <MacrosSection />,
  },
  {
    key: 'sla',
    label: 'SLA',
    description: 'Response and resolution targets',
    icon: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z',
    render: () => <SlaSection />,
  },
  {
    key: 'chatbot',
    label: 'Chatbot',
    description: 'What the chat bot does: enquiries, support, or both',
    icon: 'M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684ZM13.949 13.684a1 1 0 0 0-1.898 0l-.184.551a1 1 0 0 1-.632.633l-.551.183a1 1 0 0 0 0 1.898l.551.183a1 1 0 0 1 .633.633l.183.551a1 1 0 0 0 1.898 0l.184-.551a1 1 0 0 1 .632-.633l.551-.183a1 1 0 0 0 0-1.898l-.551-.184a1 1 0 0 1-.633-.632l-.183-.551Z',
    render: () => <BotPurposeSection />,
  },
  {
    key: 'chat-widget',
    label: 'Chat widget',
    description: 'Look, behavior and allowed sites',
    icon: 'M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 0 0 1.28.53l3.58-3.579a.78.78 0 0 1 .527-.224 41.202 41.202 0 0 0 5.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0 0 10 2Z',
    render: () => <ChatWidgetSection />,
  },
  {
    key: 'knowledge',
    label: 'Knowledge base',
    description: 'Articles the chatbot answers from',
    icon: 'M10.75 16.82A7.462 7.462 0 0 1 15 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0 0 18 15.06v-11a.75.75 0 0 0-.546-.721A9.006 9.006 0 0 0 15 3a8.963 8.963 0 0 0-4.25 1.065V16.82ZM9.25 4.065A8.963 8.963 0 0 0 5 3c-.85 0-1.673.118-2.454.339A.75.75 0 0 0 2 4.06v11a.75.75 0 0 0 .954.721A7.506 7.506 0 0 1 5 15.5c1.579 0 3.042.487 4.25 1.32V4.065Z',
    render: () => <KnowledgeSection />,
  },
];

function SettingsPage() {
  const { agent } = useAuth();
  const [params, setParams] = useSearchParams();
  const active = TABS.find((t) => t.key === params.get('tab')) || TABS[0];

  const selectTab = (key) => setParams(key === TABS[0].key ? {} : { tab: key }, { replace: true });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Organization and team management</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Organization</p>
          <p className="text-sm font-semibold text-gray-900">{agent?.orgName || 'Your organization'}</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav
          role="tablist"
          aria-label="Settings sections"
          aria-orientation="vertical"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-6 lg:mx-0 lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {TABS.map((tab) => {
            const selected = tab.key === active.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`settings-tab-${tab.key}`}
                aria-selected={selected}
                aria-controls="settings-panel"
                onClick={() => selectTab(tab.key)}
                className={`${selected ? navItemActiveClass : navItemClass} shrink-0 whitespace-nowrap text-left`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
                  <path fillRule="evenodd" clipRule="evenodd" d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            );
          })}
        </nav>

        <section
          id="settings-panel"
          role="tabpanel"
          aria-labelledby={`settings-tab-${active.key}`}
          className="min-w-0 flex-1"
        >
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">{active.label}</h2>
            <p className="mt-0.5 text-sm text-gray-500">{active.description}</p>
          </div>
          {active.render()}
        </section>
      </div>
    </div>
  );
}

export default SettingsPage;

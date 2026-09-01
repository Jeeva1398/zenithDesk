import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createTicket, listTickets, updateTicket } from '../api/tickets';
import { listAgents } from '../api/agents';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import StatCard from '../components/StatCard';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../lib/ui';

const STATUSES = ['open', 'pending', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const emptyForm = {
  customerName: '',
  customerEmail: '',
  subject: '',
  description: '',
  category: '',
  priority: 'medium',
};

function TicketsPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const filters = {
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    category: searchParams.get('category') || '',
    assignedAgentId: searchParams.get('assignedAgentId') || '',
  };

  const loadTickets = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listTickets(token, filters);
      setTickets(result.tickets);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  useEffect(() => {
    listAgents(token)
      .then((result) => setAgents(result.agents))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [pendingFilters, setPendingFilters] = useState(filters);
  useEffect(() => {
    setPendingFilters(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const stats = useMemo(
    () => ({
      total: tickets.length,
      open: tickets.filter((t) => t.status === 'open').length,
      pending: tickets.filter((t) => t.status === 'pending').length,
      resolved: tickets.filter((t) => t.status === 'resolved').length,
    }),
    [tickets],
  );

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    const next = Object.fromEntries(Object.entries(pendingFilters).filter(([, v]) => v));
    setSearchParams(next);
  };

  const handleClearFilters = () => {
    setSearchParams({});
  };

  const handleAssign = async (ticketId, agentId) => {
    try {
      await updateTicket(token, ticketId, { assignedAgentId: agentId || null });
      loadTickets();
    } catch (err) {
      setError(err.message);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm);
    setFormError('');
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setCreating(true);
    try {
      await createTicket(token, form);
      closeForm();
      loadTickets();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tickets</h1>
          <p className="mt-1 text-sm text-gray-500">Manage and respond to customer requests</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)} className={primaryButtonClass}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          New ticket
        </button>
      </div>

      {hasActiveFilters ? (
        <p className="mb-6 text-sm text-gray-500">Showing filtered results.</p>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total" value={loading ? null : stats.total} tone="gray" />
          <StatCard label="Open" value={loading ? null : stats.open} tone="blue" />
          <StatCard label="Pending" value={loading ? null : stats.pending} tone="amber" />
          <StatCard label="Resolved" value={loading ? null : stats.resolved} tone="emerald" />
        </div>
      )}

      <form
        onSubmit={handleFilterSubmit}
        className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <select
          value={pendingFilters.status}
          onChange={(e) => setPendingFilters({ ...pendingFilters, status: e.target.value })}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm capitalize text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>
        <select
          value={pendingFilters.priority}
          onChange={(e) => setPendingFilters({ ...pendingFilters, priority: e.target.value })}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm capitalize text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p} className="capitalize">
              {p}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Category"
          value={pendingFilters.category}
          onChange={(e) => setPendingFilters({ ...pendingFilters, category: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
        <button type="submit" className={secondaryButtonClass}>
          Filter
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Clear filters
          </button>
        )}
      </form>

      {loading && (
        <div className="flex justify-center py-16">
          <p className="text-sm text-gray-500">Loading tickets…</p>
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!loading && !error && tickets.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
              <path
                fillRule="evenodd"
                d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.677 3.348-3.97Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">No tickets found</h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            {hasActiveFilters
              ? 'Try adjusting or clearing your filters.'
              : 'Get started by creating your first support ticket.'}
          </p>
          {!hasActiveFilters && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className={`${primaryButtonClass} mt-5`}
            >
              New ticket
            </button>
          )}
        </div>
      )}

      {!loading && tickets.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Priority</th>
                <th className="px-5 py-3">Tags</th>
                <th className="px-5 py-3">Assignee</th>
                <th className="px-5 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="transition hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/tickets/${ticket.id}`}
                      className="font-medium text-gray-900 hover:text-indigo-600"
                    >
                      {ticket.subject}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge type="status" value={ticket.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge type="priority" value={ticket.priority} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {ticket.tags?.length > 0
                        ? ticket.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                            >
                              {tag}
                            </span>
                          ))
                        : '—'}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <select
                      value={ticket.assigned_agent_id || ''}
                      onChange={(e) => handleAssign(ticket.id, e.target.value || null)}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    >
                      <option value="">Unassigned</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {new Date(ticket.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title="New ticket" onClose={closeForm}>
          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Customer name</label>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Customer email</label>
                <input
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                rows={3}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Category (optional)</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className={`${inputClass} capitalize`}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p} className="capitalize">
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
            )}

            <div className="mt-1 flex justify-end gap-3">
              <button type="button" onClick={closeForm} className={secondaryButtonClass}>
                Cancel
              </button>
              <button type="submit" disabled={creating} className={primaryButtonClass}>
                {creating ? 'Creating…' : 'Create ticket'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default TicketsPage;

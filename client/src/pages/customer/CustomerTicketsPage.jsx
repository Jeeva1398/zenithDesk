import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createMyTicket, listMyTickets } from '../../api/customerTickets';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { cardClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../../lib/ui';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const emptyForm = { subject: '', description: '', category: '', priority: 'medium' };

function CustomerTicketsPage() {
  const { token } = useCustomerAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  const loadTickets = () => {
    setLoading(true);
    listMyTickets(token)
      .then((data) => setTickets(data.tickets))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadTickets, [token]);

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
      await createMyTicket(token, form);
      closeForm();
      loadTickets();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Your support tickets</h1>
        <button type="button" onClick={() => setShowForm(true)} className={primaryButtonClass}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          New ticket
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {tickets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500">
          You haven&apos;t submitted any tickets yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/portal/tickets/${ticket.id}`}
              className={`${cardClass} flex items-center justify-between gap-4 p-4 transition hover:border-gray-300`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{ticket.subject}</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Ticket #{ticket.id} · {new Date(ticket.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge type="priority" value={ticket.priority} />
                <Badge type="status" value={ticket.status} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title="New ticket" onClose={closeForm}>
          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
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
                rows={4}
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
                {creating ? 'Submitting…' : 'Submit ticket'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default CustomerTicketsPage;

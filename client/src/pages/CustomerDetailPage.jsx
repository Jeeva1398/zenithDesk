import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteCustomer, getCustomer, updateCustomer } from '../api/customers';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { cardClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../lib/ui';

function CustomerDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadCustomer = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getCustomer(token, id);
      setCustomer(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openEdit = () => {
    setForm({ name: customer.name, email: customer.email });
    setFormError('');
    setShowEdit(true);
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const updated = await updateCustomer(token, id, form);
      setCustomer(updated);
      setShowEdit(false);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${customer.name}? This cannot be undone.`)) {
      return;
    }
    setDeleteError('');
    setDeleting(true);
    try {
      await deleteCustomer(token, id);
      navigate('/customers');
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  if (!customer) {
    return null;
  }

  const hasTickets = customer.tickets.length > 0;

  return (
    <div>
      <Link
        to="/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
            clipRule="evenodd"
          />
        </svg>
        Back to customers
      </Link>

      <div className={`${cardClass} p-6`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{customer.name}</h1>
            <p className="mt-1 text-sm text-gray-500">{customer.email}</p>
            <p className="mt-3 text-xs text-gray-400">
              Customer since {new Date(customer.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={openEdit} className={secondaryButtonClass}>
              Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={hasTickets || deleting}
              title={hasTickets ? 'Cannot delete a customer with existing tickets' : undefined}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
        {deleteError && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>
        )}
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          Tickets {customer.tickets.length > 0 && `(${customer.tickets.length})`}
        </h2>

        {customer.tickets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
            This customer hasn&apos;t submitted any tickets.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {customer.tickets.map((ticket) => (
              <Link
                key={ticket.id}
                to={`/tickets/${ticket.id}`}
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
      </div>

      {showEdit && (
        <Modal title="Edit customer" onClose={() => setShowEdit(false)}>
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
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

            {formError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
            )}

            <div className="mt-1 flex justify-end gap-3">
              <button type="button" onClick={() => setShowEdit(false)} className={secondaryButtonClass}>
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

export default CustomerDetailPage;

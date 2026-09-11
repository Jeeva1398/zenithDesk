import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createCustomer, listCustomers } from '../api/customers';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../lib/ui';

const emptyForm = { name: '', email: '' };

function CustomersPage() {
  const { token } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  const loadCustomers = () => {
    setLoading(true);
    listCustomers(token)
      .then((data) => setCustomers(data.customers))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadCustomers, [token]);

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
      await createCustomer(token, form);
      closeForm();
      loadCustomers();
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
          <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">Everyone who has submitted a ticket</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)} className={primaryButtonClass}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          New customer
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <p className="text-sm text-gray-500">Loading customers…</p>
        </div>
      )}

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!loading && !error && customers.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500">
          No customers yet.
        </p>
      )}

      {!loading && customers.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Tickets</th>
                <th className="px-5 py-3">Last ticket</th>
                <th className="px-5 py-3">Customer since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((customer) => (
                <tr key={customer.id} className="transition hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/customers/${customer.id}`}
                      className="font-medium text-gray-900 hover:text-indigo-600"
                    >
                      {customer.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{customer.email}</td>
                  <td className="px-5 py-3.5 text-gray-600">{customer.ticket_count}</td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {customer.last_ticket_at ? new Date(customer.last_ticket_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {new Date(customer.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title="New customer" onClose={closeForm}>
          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
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
              <button type="button" onClick={closeForm} className={secondaryButtonClass}>
                Cancel
              </button>
              <button type="submit" disabled={creating} className={primaryButtonClass}>
                {creating ? 'Creating…' : 'Create customer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default CustomersPage;

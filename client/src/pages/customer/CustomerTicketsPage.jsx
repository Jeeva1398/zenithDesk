import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMyTickets } from '../../api/customerTickets';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import Badge from '../../components/Badge';
import { cardClass } from '../../lib/ui';

function CustomerTicketsPage() {
  const { token } = useCustomerAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listMyTickets(token)
      .then((data) => setTickets(data.tickets))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Your support tickets</h1>

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
    </div>
  );
}

export default CustomerTicketsPage;

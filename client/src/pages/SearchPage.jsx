import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { search } from '../api/search';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import { cardClass } from '../lib/ui';

function SearchPage() {
  const { token } = useAuth();
  const [params] = useSearchParams();
  const query = params.get('q') || '';

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    search(token, query)
      .then((data) => {
        // A slow response for an older term must not overwrite a newer one.
        if (!cancelled) setResults(data);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Search</h1>
        {query && (
          <p className="mt-1 text-sm text-gray-500">
            {loading ? 'Searching' : 'Results'} for <span className="font-medium">{query}</span>
            {results && !loading && ` - ${results.total} match${results.total === 1 ? '' : 'es'}`}
          </p>
        )}
      </div>

      {!query && <p className="text-sm text-gray-500">Type a search above to get started.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {results && !loading && results.total === 0 && (
        <div className={`${cardClass} p-8 text-center`}>
          <p className="text-sm text-gray-500">
            Nothing matched <span className="font-medium">{query}</span>. Try a customer email, a
            tag, or a ticket number like #12.
          </p>
        </div>
      )}

      {results && !loading && results.tickets.length > 0 && (
        <div className={`${cardClass} mb-8 overflow-hidden`}>
          <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Tickets ({results.tickets.length})
            </h2>
          </div>
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-gray-100">
              {results.tickets.map((ticket) => (
                <tr key={ticket.id} className="transition hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/tickets/${ticket.id}`}
                      className="font-medium text-gray-900 hover:text-indigo-600"
                    >
                      #{ticket.id} {ticket.subject}
                    </Link>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {ticket.customer_name} · {ticket.customer_email}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge type="status" value={ticket.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge type="priority" value={ticket.priority} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results && !loading && results.customers.length > 0 && (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Customers ({results.customers.length})
            </h2>
          </div>
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-gray-100">
              {results.customers.map((customer) => (
                <tr key={customer.id} className="transition hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/customers/${customer.id}`}
                      className="font-medium text-gray-900 hover:text-indigo-600"
                    >
                      {customer.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-gray-500">{customer.email}</p>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {customer.ticket_count} ticket{Number(customer.ticket_count) === 1 ? '' : 's'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SearchPage;

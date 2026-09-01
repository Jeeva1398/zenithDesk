import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getMyTicket } from '../../api/customerTickets';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import Badge from '../../components/Badge';
import { cardClass } from '../../lib/ui';

function CustomerTicketDetailPage() {
  const { id } = useParams();
  const { token } = useCustomerAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getMyTicket(token, id)
      .then(setTicket)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, id]);

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

  if (!ticket) {
    return null;
  }

  return (
    <div>
      <Link
        to="/portal/tickets"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
            clipRule="evenodd"
          />
        </svg>
        Back to tickets
      </Link>

      <div className={`${cardClass} p-6`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge type="status" value={ticket.status} />
          <Badge type="priority" value={ticket.priority} />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">{ticket.subject}</h1>
        <p className="mt-1 text-sm text-gray-500">Ticket #{ticket.id}</p>
        <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
          {ticket.description}
        </p>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          Updates {ticket.comments.length > 0 && `(${ticket.comments.length})`}
        </h2>

        {ticket.comments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
            No replies yet — our team will get back to you soon.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {ticket.comments.map((comment) => (
              <div key={comment.id} className={`${cardClass} p-4 text-sm`}>
                <p className="whitespace-pre-wrap text-gray-800">{comment.body}</p>
                <p className="mt-2 text-xs text-gray-400">
                  {new Date(comment.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerTicketDetailPage;

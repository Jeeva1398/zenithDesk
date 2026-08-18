import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addComment, getTicket, updateTicket } from '../api/tickets';
import { useAuth } from '../context/AuthContext';
import StyledSelect from '../components/StyledSelect';
import { cardClass, inputClass, primaryButtonClass } from '../lib/ui';

const STATUSES = ['open', 'pending', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

function MetaRow({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm text-gray-900">{value}</p>
    </div>
  );
}

function TicketDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [commentError, setCommentError] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const loadTicket = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getTicket(token, id);
      setTicket(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleFieldUpdate = async (field, value) => {
    setUpdating(true);
    setError('');
    try {
      const updated = await updateTicket(token, id, { [field]: value });
      setTicket(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    setCommentError('');
    setSubmittingComment(true);
    try {
      await addComment(token, id, commentBody);
      setCommentBody('');
      await loadTicket();
    } catch (err) {
      setCommentError(err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error && !ticket) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  if (!ticket) {
    return null;
  }

  return (
    <div>
      <Link
        to="/tickets"
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

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className={`${cardClass} p-6`}>
            <h1 className="text-xl font-semibold text-gray-900">{ticket.subject}</h1>
            <p className="mt-1 text-sm text-gray-500">Ticket #{ticket.id}</p>
            <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {ticket.description}
            </p>
          </div>

          <div className="mt-8">
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              Comments {ticket.comments.length > 0 && `(${ticket.comments.length})`}
            </h2>

            {ticket.comments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
                No comments yet — start the conversation below.
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

            <form onSubmit={handleCommentSubmit} className={`${cardClass} mt-4 p-4`}>
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Add a reply…"
                required
                rows={3}
                className={inputClass}
              />
              {commentError && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {commentError}
                </p>
              )}
              <div className="mt-3 flex justify-end">
                <button type="submit" disabled={submittingComment} className={primaryButtonClass}>
                  {submittingComment ? 'Posting…' : 'Post reply'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <aside className="lg:col-span-1">
          <div className={`${cardClass} sticky top-6 flex flex-col gap-4 p-5`}>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                Status
              </p>
              <StyledSelect
                type="status"
                value={ticket.status}
                options={STATUSES}
                disabled={updating}
                onChange={(value) => handleFieldUpdate('status', value)}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                Priority
              </p>
              <StyledSelect
                type="priority"
                value={ticket.priority}
                options={PRIORITIES}
                disabled={updating}
                onChange={(value) => handleFieldUpdate('priority', value)}
              />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <MetaRow
                label="Customer"
                value={ticket.customer_name || `Customer #${ticket.customer_id}`}
              />
              {ticket.customer_email && (
                <p className="mt-0.5 text-sm text-gray-500">{ticket.customer_email}</p>
              )}
            </div>

            <MetaRow label="Category" value={ticket.category || 'Uncategorized'} />
            <MetaRow label="Created" value={new Date(ticket.created_at).toLocaleString()} />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default TicketDetailPage;

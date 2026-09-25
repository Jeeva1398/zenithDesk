import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getEnquiry, listEnquiries, updateEnquiry } from '../api/enquiries';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../lib/ui';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'closed', label: 'Closed' },
];

const STATUS_STYLES = {
  new: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  contacted: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  closed: 'bg-gray-100 text-gray-600 ring-gray-500/20',
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function formatWhen(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function EnquiryModal({ enquiry, onClose, onSaved }) {
  const { token } = useAuth();
  const [status, setStatus] = useState(enquiry.status);
  const [notes, setNotes] = useState(enquiry.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty = status !== enquiry.status || notes !== (enquiry.notes || '');

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      onSaved(await updateEnquiry(token, enquiry.id, { status, notes }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={enquiry.name} onClose={onClose}>
      <dl className="mb-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {enquiry.company && (
          <>
            <dt className="text-gray-500">Company</dt>
            <dd className="text-gray-900">{enquiry.company}</dd>
          </>
        )}
        {enquiry.email && (
          <>
            <dt className="text-gray-500">Email</dt>
            <dd>
              <a href={`mailto:${enquiry.email}`} className="text-indigo-600 hover:text-indigo-700">
                {enquiry.email}
              </a>
            </dd>
          </>
        )}
        {enquiry.phone && (
          <>
            <dt className="text-gray-500">Phone</dt>
            <dd>
              <a href={`tel:${enquiry.phone.replace(/[^\d+]/g, '')}`} className="text-indigo-600 hover:text-indigo-700">
                {enquiry.phone}
              </a>
            </dd>
          </>
        )}
        <dt className="text-gray-500">Received</dt>
        <dd className="text-gray-900">{formatWhen(enquiry.created_at)} · via chat</dd>
      </dl>

      <p className={labelClass}>Message</p>
      <p className="mb-5 whitespace-pre-wrap rounded-lg bg-gray-50 px-3.5 py-3 text-sm text-gray-800">{enquiry.message}</p>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div>
          <label htmlFor="enquiry-status" className={labelClass}>
            Status
          </label>
          <select
            id="enquiry-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
          >
            {STATUS_TABS.filter((t) => t.value).map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="enquiry-notes" className={labelClass}>
            Notes
          </label>
          <textarea
            id="enquiry-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Follow-up details for your team"
            className={inputClass}
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Close
          </button>
          <button type="submit" disabled={saving || !dirty} className={primaryButtonClass}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EnquiriesPage() {
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const page = Number(params.get('page')) || 1;
  const openId = params.get('open');

  const [search, setSearch] = useState(params.get('q') || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const q = params.get('q') || '';

  const updateParams = (changes) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listEnquiries(token, { status, q, page })
      .then((result) => {
        if (!cancelled) setData(result);
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
  }, [token, status, q, page]);

  // ?open=<id> is what the alert email links to.
  useEffect(() => {
    if (!openId) {
      setOpen(null);
      return;
    }
    const known = data?.enquiries.find((e) => String(e.id) === openId);
    if (known) {
      setOpen(known);
      return;
    }
    getEnquiry(token, openId)
      .then(setOpen)
      .catch(() => updateParams({ open: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, token]);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (search.trim() !== q) updateParams({ q: search.trim(), page: null });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleSaved = (updated) => {
    setOpen(updated);
    setData((current) => {
      if (!current) return current;
      const previous = current.enquiries.find((e) => e.id === updated.id);
      const counts = { ...current.counts };
      if (previous && previous.status !== updated.status) {
        counts[previous.status] -= 1;
        counts[updated.status] += 1;
      }
      return {
        ...current,
        counts,
        enquiries: current.enquiries.map((e) => (e.id === updated.id ? updated : e)),
      };
    });
  };

  const totalAll = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Enquiries</h1>
          <p className="mt-1 text-sm text-gray-500">Leads and questions the chat widget took down</p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone or company"
          aria-label="Search enquiries"
          className={`${inputClass} sm:w-80`}
        />
      </div>

      <div role="tablist" aria-label="Filter by status" className="mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-gray-200">
        {STATUS_TABS.map((tab) => {
          const selected = tab.value === status;
          const count = data ? (tab.value ? data.counts[tab.value] : totalAll) : null;
          return (
            <button
              key={tab.value || 'all'}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => updateParams({ status: tab.value, page: null })}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
                selected
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
              {count !== null && (
                <span className={`rounded-full px-1.5 text-xs ${selected ? 'bg-indigo-50' : 'bg-gray-100'}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading && !data && (
        <div className="flex justify-center py-16">
          <p className="text-sm text-gray-500">Loading enquiries…</p>
        </div>
      )}

      {data && data.enquiries.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500">
          {totalAll === 0 && !q ? (
            <>
              No enquiries yet. They arrive here when your chat widget takes enquiries -{' '}
              <Link to="/settings?tab=chatbot" className="font-medium text-indigo-600 hover:text-indigo-700">
                set that up in Settings
              </Link>
              .
            </>
          ) : (
            'No enquiries match.'
          )}
        </div>
      )}

      {data && data.enquiries.length > 0 && (
        <div
          className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity"
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Message</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.enquiries.map((enquiry) => (
                <tr
                  key={enquiry.id}
                  onClick={() => updateParams({ open: String(enquiry.id) })}
                  className="cursor-pointer transition hover:bg-gray-50"
                >
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateParams({ open: String(enquiry.id) });
                      }}
                      className="font-medium text-gray-900 hover:text-indigo-600"
                    >
                      {enquiry.name}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{enquiry.company || '-'}</td>
                  <td className="px-5 py-3.5 text-gray-600">
                    <div className="flex flex-col">
                      {enquiry.email && <span>{enquiry.email}</span>}
                      {enquiry.phone && <span className="text-gray-500">{enquiry.phone}</span>}
                    </div>
                  </td>
                  <td className="max-w-xs px-5 py-3.5 text-gray-600">
                    <p className="truncate">{enquiry.message}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={enquiry.status} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-gray-500">{formatWhen(enquiry.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>
            Page {page} of {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => updateParams({ page: page - 1 > 1 ? String(page - 1) : null })}
              className={secondaryButtonClass}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => updateParams({ page: String(page + 1) })}
              className={secondaryButtonClass}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {open && (
        <EnquiryModal
          key={open.id}
          enquiry={open}
          onClose={() => updateParams({ open: null })}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

export default EnquiriesPage;

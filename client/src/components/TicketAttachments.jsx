import { useEffect, useState } from 'react';
import { downloadAttachment } from '../api/tickets';
import { useAuth } from '../context/AuthContext';
import { cardClass } from '../lib/ui';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(attachment) {
  return attachment.mime_type.startsWith('image/');
}

// Attachments need the agent's bearer token, so neither a thumbnail nor a
// download can be a plain URL - each is fetched as a blob and handed to the
// browser as an object URL, which is released again when the page moves on.
function TicketAttachments({ ticketId, attachments }) {
  const { token } = useAuth();
  const [previews, setPreviews] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const urls = [];

    attachments.filter(isImage).forEach((attachment) => {
      downloadAttachment(token, ticketId, attachment.id)
        .then((blob) => {
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          setPreviews((current) => ({ ...current, [attachment.id]: url }));
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, attachments]);

  const handleDownload = async (attachment) => {
    setError('');
    try {
      const blob = await downloadAttachment(token, ticketId, attachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      setError(err.message);
    }
  };

  if (attachments.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="mb-4 text-base font-semibold text-gray-900">
        Attachments ({attachments.length})
      </h2>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {attachments.map((attachment) => (
          <button
            key={attachment.id}
            type="button"
            onClick={() => handleDownload(attachment)}
            className={`${cardClass} flex items-center gap-3 p-3 text-left transition hover:border-indigo-300`}
          >
            {isImage(attachment) && previews[attachment.id] ? (
              <img
                src={previews[attachment.id]}
                alt=""
                // A file can carry a valid image signature and still fail to
                // decode; fall back to the plain tile rather than a broken icon.
                onError={() =>
                  setPreviews((current) => ({ ...current, [attachment.id]: undefined }))
                }
                className="size-12 flex-shrink-0 rounded-md border border-gray-200 object-cover"
              />
            ) : (
              <span className="flex size-12 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs font-semibold uppercase text-gray-500">
                {attachment.mime_type === 'application/pdf' ? 'PDF' : 'IMG'}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-gray-900">
                {attachment.filename}
              </span>
              <span className="block text-xs text-gray-500">
                {formatSize(attachment.size_bytes)} ·{' '}
                {new Date(attachment.created_at).toLocaleString()}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default TicketAttachments;

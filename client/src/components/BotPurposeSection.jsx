import { useEffect, useState } from 'react';
import { getChatWidgetSettings, updateChatWidgetSettings } from '../api/chatWidget';
import { useAuth } from '../context/AuthContext';
import { cardClass, inputClass, labelClass, primaryButtonClass } from '../lib/ui';

const PURPOSES = [
  {
    key: 'enquiry',
    label: 'Take enquiries',
    description: 'Collects what a visitor is looking for, with their name, email or phone, and company. Lands on the Enquiries page.',
  },
  {
    key: 'support',
    label: 'Raise support tickets',
    description: 'Collects the problem, category and priority, then opens a ticket.',
  },
  {
    key: 'knowledge',
    label: 'Answer from the knowledge base',
    description: 'Tries your published articles first, before taking anything down.',
  },
  {
    key: 'status',
    label: 'Check ticket status',
    description: 'Lets a customer look up their tickets after confirming their email.',
  },
];

const PRESETS = [
  { key: 'enquiry', label: 'Enquiry only', purposes: { enquiry: true, support: false, knowledge: true, status: false } },
  { key: 'support', label: 'Support only', purposes: { enquiry: false, support: true, knowledge: true, status: true } },
  { key: 'both', label: 'Enquiry + support', purposes: { enquiry: true, support: true, knowledge: true, status: true } },
];

function samePurposes(a, b) {
  return PURPOSES.every(({ key }) => a[key] === b[key]);
}

function BotPurposeSection() {
  const { token, agent } = useAuth();
  const isAdmin = agent?.role === 'admin';

  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    getChatWidgetSettings(token)
      .then((result) => setDraft(result.bot))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className={`${cardClass} p-5`}>
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className={`${cardClass} p-5`}>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  const disabled = !isAdmin || saving;
  const { purposes } = draft;
  const activePreset = PRESETS.find((p) => samePurposes(p.purposes, purposes));
  const nothingOn = !PURPOSES.some(({ key }) => purposes[key]);
  const takesTickets = purposes.support;

  const setPurposes = (next) => {
    setSuccess('');
    setDraft((current) => ({ ...current, purposes: next }));
  };
  const setField = (field, value) => {
    setSuccess('');
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await updateChatWidgetSettings(token, { bot: draft });
      setDraft(updated.bot);
      setSuccess('Saved. Open chats pick this up within a few minutes.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      {!isAdmin && <p className="text-sm text-gray-500">Only an admin can change what the bot does.</p>}

      <fieldset className={`${cardClass} p-5`} disabled={disabled}>
        <legend className="sr-only">What the bot does</legend>
        <h3 className="text-base font-semibold text-gray-900">What the bot does</h3>
        <p className="mt-0.5 mb-4 text-sm text-gray-500">Start from a preset, or pick exactly what you need.</p>

        <div className="mb-5 flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const selected = activePreset?.key === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setPurposes(preset.purposes)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  selected
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
          {!activePreset && (
            <span className="rounded-full border border-indigo-600 bg-indigo-50 px-3.5 py-1.5 text-sm font-medium text-indigo-700">
              Custom
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {PURPOSES.map((purpose) => (
            <label
              key={purpose.key}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3.5 transition ${
                purposes[purpose.key] ? 'border-indigo-500/60 bg-indigo-50/60' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={purposes[purpose.key]}
                onChange={(e) => setPurposes({ ...purposes, [purpose.key]: e.target.checked })}
                className="mt-0.5 size-4 shrink-0 accent-indigo-600"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">{purpose.label}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{purpose.description}</span>
              </span>
            </label>
          ))}
        </div>
        {nothingOn && <p className="mt-3 text-sm text-red-600">Turn on at least one thing for the bot to do.</p>}
      </fieldset>

      {purposes.enquiry && (
        <fieldset className={`${cardClass} p-5`} disabled={disabled}>
          <legend className="sr-only">Enquiry alerts</legend>
          <h3 className="text-base font-semibold text-gray-900">Enquiry alerts</h3>
          <p className="mt-0.5 mb-4 text-sm text-gray-500">
            Each new enquiry is emailed to this address only. Leave it empty to just collect them on the Enquiries page.
          </p>
          <div className="max-w-md">
            <label htmlFor="bot-alert-email" className={labelClass}>
              Send new enquiries to
            </label>
            <input
              id="bot-alert-email"
              type="email"
              value={draft.enquiryAlertEmail}
              onChange={(e) => setField('enquiryAlertEmail', e.target.value)}
              placeholder="sales@yourcompany.com"
              className={inputClass}
            />
          </div>
        </fieldset>
      )}

      <fieldset className={`${cardClass} p-5`} disabled={disabled}>
        <legend className="sr-only">Wording</legend>
        <h3 className="text-base font-semibold text-gray-900">Wording</h3>
        <p className="mt-0.5 mb-4 text-sm text-gray-500">Helps the bot sound like you and stay on topic.</p>
        <div className="flex max-w-2xl flex-col gap-4">
          <div>
            <label htmlFor="bot-company" className={labelClass}>
              About your company
            </label>
            <textarea
              id="bot-company"
              rows={3}
              maxLength={500}
              value={draft.companyDescription}
              onChange={(e) => setField('companyDescription', e.target.value)}
              placeholder="e.g. Acme makes invoicing software for small shops in India."
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-400">{draft.companyDescription.length}/500</p>
          </div>
          <div>
            <label htmlFor="bot-out-of-scope" className={labelClass}>
              Reply for requests the bot does not handle
            </label>
            <textarea
              id="bot-out-of-scope"
              rows={2}
              maxLength={300}
              value={draft.outOfScopeMessage}
              onChange={(e) => setField('outOfScopeMessage', e.target.value)}
              placeholder={
                takesTickets
                  ? 'e.g. For sales questions, call +91 98765 43210.'
                  : 'e.g. For help with an existing order, email support@yourcompany.com.'
              }
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-400">
              Shown when someone asks for something you have turned off above.
            </p>
          </div>
        </div>
      </fieldset>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}

      {isAdmin && (
        <div className="flex justify-end">
          <button type="submit" disabled={saving || nothingOn} className={primaryButtonClass}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </form>
  );
}

export default BotPurposeSection;

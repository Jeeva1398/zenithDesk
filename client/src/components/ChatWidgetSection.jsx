import { useEffect, useState } from 'react';
import {
  getChatWidgetSettings,
  regenerateChatWidgetKey,
  updateChatWidgetSettings,
} from '../api/chatWidget';
import { useAuth } from '../context/AuthContext';
import { cardClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../lib/ui';

// Where the chatbot server serves the built widget bundle. It is also how the
// widget finds its API: it talks to whichever host it was loaded from.
const CHATBOT_URL = (import.meta.env.VITE_CHATBOT_URL || 'http://localhost:4000').replace(/\/$/, '');

const PRESETS = [
  { name: 'Blue', primaryColor: '#2563eb' },
  { name: 'Indigo', primaryColor: '#4f46e5' },
  { name: 'Emerald', primaryColor: '#059669' },
  { name: 'Violet', primaryColor: '#7c3aed' },
  { name: 'Rose', primaryColor: '#e11d48' },
  { name: 'Charcoal', primaryColor: '#1f2937' },
];

const COLOR_FIELDS = [
  ['primaryColor', 'Brand colour'],
  ['primaryTextColor', 'Text on brand colour'],
  ['botBubbleColor', 'Bot bubble'],
  ['botTextColor', 'Bot text'],
  ['panelBackground', 'Panel background'],
];

const FONTS = [
  ['system', 'System'],
  ['serif', 'Serif'],
  ['mono', 'Monospace'],
  ['rounded', 'Rounded'],
];

// Mirrors the widget's own stacks so the preview is what a visitor will see.
const FONT_STACKS = {
  system: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  rounded: "ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif",
};

const ATTACHMENT_TYPES = [
  ['png', 'PNG'],
  ['jpg', 'JPG'],
  ['webp', 'WebP'],
  ['gif', 'GIF'],
  ['pdf', 'PDF'],
];

function toDraft(settings) {
  return {
    theme: { ...settings.theme },
    attachments: { ...settings.tools.attachments },
    domains: settings.allowedDomains.join('\n'),
  };
}

function WidgetPreview({ theme }) {
  const side = theme.position === 'left' ? 'items-start' : 'items-end';
  const bubble = `${theme.bubbleRadius}px`;

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl bg-gray-100 p-4 ${side}`}
      style={{ fontFamily: FONT_STACKS[theme.fontFamily] }}
    >
      <div
        className="w-full max-w-[300px] overflow-hidden shadow-lg"
        style={{ borderRadius: `${theme.cornerRadius}px`, background: theme.panelBackground }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ background: theme.primaryColor, color: theme.primaryTextColor }}
        >
          {theme.logoUrl && (
            <img src={theme.logoUrl} alt="" className="size-7 rounded-full bg-white object-cover" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{theme.title || 'Support'}</p>
            {theme.subtitle && <p className="truncate text-xs opacity-80">{theme.subtitle}</p>}
          </div>
        </div>
        <div className="flex flex-col gap-2 p-3 text-[13px]">
          <div className="flex">
            <span
              className="max-w-[80%] px-3 py-2"
              style={{ background: theme.botBubbleColor, color: theme.botTextColor, borderRadius: bubble }}
            >
              {theme.greeting || 'Hi! Tell me what is going on and I will get a ticket started.'}
            </span>
          </div>
          <div className="flex justify-end">
            <span
              className="max-w-[80%] px-3 py-2"
              style={{ background: theme.primaryColor, color: theme.primaryTextColor, borderRadius: bubble }}
            >
              My invoice is wrong
            </span>
          </div>
        </div>
        <div className="border-t border-gray-200 p-2.5">
          <div className="rounded-full border border-gray-300 px-3 py-1.5 text-xs text-gray-400">
            {theme.placeholder}
          </div>
        </div>
      </div>
      <span
        className="flex size-12 items-center justify-center overflow-hidden rounded-full text-xl shadow-md"
        style={{ background: theme.primaryColor, color: theme.primaryTextColor }}
      >
        {theme.launcherIcon === 'logo' && theme.logoUrl ? (
          <img src={theme.logoUrl} alt="" className="size-full object-cover" />
        ) : (
          '💬'
        )}
      </span>
    </div>
  );
}

function ChatWidgetSection() {
  const { token, agent } = useAuth();
  const isAdmin = agent?.role === 'admin';

  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getChatWidgetSettings(token)
      .then((result) => {
        setSettings(result);
        setDraft(toDraft(result));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = (field, value) =>
    setDraft((current) => ({ ...current, theme: { ...current.theme, [field]: value } }));

  const setAttachments = (field, value) =>
    setDraft((current) => ({ ...current, attachments: { ...current.attachments, [field]: value } }));

  const toggleType = (type) => {
    const types = draft.attachments.types.includes(type)
      ? draft.attachments.types.filter((t) => t !== type)
      : [...draft.attachments.types, type];
    setAttachments('types', types);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await updateChatWidgetSettings(token, {
        theme: draft.theme,
        tools: {
          attachments: { ...draft.attachments, maxMb: Number(draft.attachments.maxMb) },
        },
        allowedDomains: draft.domains
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      });
      setSettings(updated);
      // Re-read from the server's copy, so the admin sees domains the way they
      // are actually stored (normalised to scheme://host).
      setDraft(toDraft(updated));
      setSuccess('Chat widget saved. Open widgets pick it up within a few minutes.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    const confirmed = window.confirm(
      'Generate a new widget key? The current snippet stops working immediately on every site that uses it.',
    );
    if (!confirmed) return;
    setError('');
    setSuccess('');
    try {
      const updated = await regenerateChatWidgetKey(token);
      setSettings(updated);
      setSuccess('New key generated - update the snippet on your sites.');
    } catch (err) {
      setError(err.message);
    }
  };

  const snippet = settings
    ? `<script src="${CHATBOT_URL}/widget.js" data-key="${settings.publicKey}" defer></script>`
    : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy - select the snippet and copy it by hand.');
    }
  };

  if (loading) {
    return (
      <div className={`${cardClass} mb-8 p-5`}>
        <p className="text-sm text-gray-500">Loading chat widget…</p>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className={`${cardClass} mb-8 p-5`}>
        <h2 className="text-base font-semibold text-gray-900">Chat widget</h2>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  const { theme, attachments } = draft;
  const disabled = !isAdmin || saving;

  return (
    <div className={`${cardClass} mb-8 p-5`}>
      <h2 className="text-base font-semibold text-gray-900">Chat widget</h2>
      <p className="mt-0.5 mb-4 text-sm text-gray-500">
        How the support chat looks on your website, what customers can send through it, and which
        sites may embed it.
      </p>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="mb-3 text-sm text-emerald-600">{success}</p>}
      {!isAdmin && (
        <p className="mb-3 text-sm text-gray-500">Only an admin can change the chat widget.</p>
      )}

      <div className="mb-6">
        <p className={labelClass}>Embed code</p>
        <p className="mb-2 text-xs text-gray-500">Paste this just before &lt;/body&gt; on every page that should show the chat.</p>
        <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
          <code>{snippet}</code>
        </pre>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={handleCopy} className={secondaryButtonClass}>
            {copied ? 'Copied' : 'Copy snippet'}
          </button>
          {isAdmin && (
            <button type="button" onClick={handleRegenerate} className={secondaryButtonClass}>
              Regenerate key
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <fieldset disabled={disabled} className="flex flex-col gap-4">
            <legend className="mb-2 text-sm font-semibold text-gray-900">Brand</legend>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setTheme('primaryColor', preset.primaryColor)}
                  className="flex items-center gap-1.5 rounded-full border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <span className="size-3 rounded-full" style={{ background: preset.primaryColor }} />
                  {preset.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {COLOR_FIELDS.map(([field, label]) => (
                <label key={field} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="color"
                    value={theme[field]}
                    onChange={(e) => setTheme(field, e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-gray-300"
                  />
                  {label}
                </label>
              ))}
            </div>
            <div>
              <label className={labelClass}>Logo URL (https)</label>
              <input
                type="url"
                value={theme.logoUrl}
                onChange={(e) => setTheme('logoUrl', e.target.value)}
                placeholder="https://example.com/logo.png"
                className={inputClass}
              />
            </div>
          </fieldset>

          <fieldset disabled={disabled} className="flex flex-col gap-4">
            <legend className="mb-2 text-sm font-semibold text-gray-900">Layout</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Font</label>
                <select
                  value={theme.fontFamily}
                  onChange={(e) => setTheme('fontFamily', e.target.value)}
                  className={inputClass}
                >
                  {FONTS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Position</label>
                <select
                  value={theme.position}
                  onChange={(e) => setTheme('position', e.target.value)}
                  className={inputClass}
                >
                  <option value="right">Bottom right</option>
                  <option value="left">Bottom left</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Launcher</label>
                <select
                  value={theme.launcherIcon}
                  onChange={(e) => setTheme('launcherIcon', e.target.value)}
                  className={inputClass}
                >
                  <option value="chat">Chat bubble</option>
                  <option value="logo" disabled={!theme.logoUrl}>
                    Your logo
                  </option>
                </select>
              </div>
            </div>
            <label className="text-sm text-gray-700">
              Panel corners: {theme.cornerRadius}px
              <input
                type="range"
                min={0}
                max={24}
                value={theme.cornerRadius}
                onChange={(e) => setTheme('cornerRadius', Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
            <label className="text-sm text-gray-700">
              Bubble corners: {theme.bubbleRadius}px
              <input
                type="range"
                min={0}
                max={22}
                value={theme.bubbleRadius}
                onChange={(e) => setTheme('bubbleRadius', Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
          </fieldset>

          <fieldset disabled={disabled} className="flex flex-col gap-4">
            <legend className="mb-2 text-sm font-semibold text-gray-900">Wording</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Title</label>
                <input
                  value={theme.title}
                  maxLength={40}
                  onChange={(e) => setTheme('title', e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Subtitle</label>
                <input
                  value={theme.subtitle}
                  maxLength={60}
                  onChange={(e) => setTheme('subtitle', e.target.value)}
                  placeholder="We usually reply within a day"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Input placeholder</label>
              <input
                value={theme.placeholder}
                maxLength={60}
                onChange={(e) => setTheme('placeholder', e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Greeting (optional)</label>
              <textarea
                value={theme.greeting}
                maxLength={200}
                rows={2}
                onChange={(e) => setTheme('greeting', e.target.value)}
                placeholder="Shown as the first message when a visitor opens the chat"
                className={inputClass}
              />
            </div>
          </fieldset>

          <fieldset disabled={disabled} className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold text-gray-900">Attachments</legend>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={attachments.enabled}
                onChange={(e) => setAttachments('enabled', e.target.checked)}
              />
              Let customers attach files (added to their ticket)
            </label>
            {attachments.enabled && (
              <>
                <div className="flex flex-wrap gap-4">
                  {ATTACHMENT_TYPES.map(([type, label]) => (
                    <label key={type} className="flex items-center gap-1.5 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={attachments.types.includes(type)}
                        onChange={() => toggleType(type)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="max-w-[12rem]">
                  <label className={labelClass}>Max file size (MB)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={attachments.maxMb}
                    onChange={(e) => setAttachments('maxMb', e.target.value)}
                    className={inputClass}
                  />
                </div>
              </>
            )}
          </fieldset>

          <fieldset disabled={disabled} className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold text-gray-900">Allowed sites</legend>
            <textarea
              value={draft.domains}
              rows={3}
              onChange={(e) => setDraft((current) => ({ ...current, domains: e.target.value }))}
              placeholder={'https://www.example.com\nhttps://help.example.com'}
              className={`${inputClass} font-mono`}
            />
            <p className="text-xs text-gray-500">
              One site per line. Leave empty to allow any site - anyone who copies the snippet
              could then raise tickets in your organization from their own pages.
            </p>
          </fieldset>

          {isAdmin && (
            <div>
              <button type="submit" disabled={saving} className={primaryButtonClass}>
                {saving ? 'Saving…' : 'Save chat widget'}
              </button>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className={labelClass}>Preview</p>
          <WidgetPreview theme={theme} />
        </div>
      </form>
    </div>
  );
}

export default ChatWidgetSection;

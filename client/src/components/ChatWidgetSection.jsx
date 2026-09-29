import { useEffect, useState } from 'react';
import { getChatWidgetSettings, regenerateChatWidgetKey, updateChatWidgetSettings } from '../api/chatWidget';
import { useAuth } from '../context/AuthContext';
import ChatWidgetPreview from './ChatWidgetPreview';
import { AVATARS } from './chatAvatars';
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

// The bot picture choices: the org's logo and flat icons, then the characters.
const AVATAR_GROUPS = [
  {
    title: 'Logo and icons',
    options: [{ key: 'logo', label: 'Your logo' }, ...AVATARS.filter((a) => a.kind === 'icon')],
  },
  { title: 'Characters', options: AVATARS.filter((a) => a.kind === 'character') },
];

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

  const setTopic = (index, field, value) =>
    setDraft((current) => ({
      ...current,
      theme: {
        ...current.theme,
        topics: current.theme.topics.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
      },
    }));
  const addTopic = () =>
    setDraft((current) => ({
      ...current,
      theme: { ...current.theme, topics: [...current.theme.topics, { title: '', subtitle: '' }] },
    }));
  const removeTopic = (index) =>
    setDraft((current) => ({
      ...current,
      theme: { ...current.theme, topics: current.theme.topics.filter((_, i) => i !== index) },
    }));

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
        How the support chat looks on your website, what customers can send through it, and which sites may embed it.
      </p>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="mb-3 text-sm text-emerald-600">{success}</p>}
      {!isAdmin && <p className="mb-3 text-sm text-gray-500">Only an admin can change the chat widget.</p>}

      <div className="mb-6">
        <p className={labelClass}>Embed code</p>
        <p className="mb-2 text-xs text-gray-500">
          Paste this just before &lt;/body&gt; on every page that should show the chat.
        </p>
        {settings.allowedDomains.length === 0 && (
          <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
            Add your website under Allowed sites below and save - until then the widget won&apos;t load.
          </p>
        )}
        <pre className="overflow-x-auto rounded-lg bg-[#0E0B30] p-3 text-xs text-[#E4E2F5] ring-1 ring-white/10">
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
              <p className={labelClass}>Bot picture</p>
              <p className="mb-3 text-xs text-gray-500">
                Shown beside the bot&apos;s replies and in the widget header, all in your brand colours. A character can
                also be the chat button on your site.
              </p>
              {AVATAR_GROUPS.map((group) => (
                <div key={group.title} className="mb-3">
                  <p className="mb-1.5 text-xs font-medium text-gray-500">{group.title}</p>
                  <div role="radiogroup" aria-label={group.title} className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                    {group.options.map((option) => {
                      const selected = theme.avatar === option.key;
                      const character = option.kind === 'character';
                      return (
                        <button
                          key={option.key}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          title={option.label}
                          onClick={() => {
                            setTheme('avatar', option.key);
                            // A character is meant to be seen on the page, so it becomes the chat
                            // button too; the logo leaves an avatar launcher with nothing to show.
                            if (character) setTheme('launcherIcon', 'avatar');
                            else if (option.key === 'logo' && theme.launcherIcon === 'avatar') {
                              setTheme('launcherIcon', 'chat');
                            }
                          }}
                          className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 text-[11px] font-medium transition ${
                            selected
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <span className={character ? 'size-12' : 'size-10 overflow-hidden rounded-full'}>
                            {character ? (
                              <option.Svg base={theme.primaryColor} shadow={false} />
                            ) : option.Svg ? (
                              <option.Svg bg={theme.primaryColor} fg={theme.primaryTextColor} />
                            ) : theme.logoUrl ? (
                              <img src={theme.logoUrl} alt="" className="size-full bg-white object-cover" />
                            ) : (
                              <span className="flex size-full items-center justify-center rounded-full border border-dashed border-gray-300 text-[10px] text-gray-400">
                                Logo
                              </span>
                            )}
                          </span>
                          <span className="w-full truncate text-center">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {theme.avatar === 'logo' && (
              <div>
                <label className={labelClass}>Logo URL (https)</label>
                <input
                  type="url"
                  value={theme.logoUrl}
                  onChange={(e) => setTheme('logoUrl', e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-gray-400">Without a logo, the bot shows a plain bot icon.</p>
              </div>
            )}
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
                  <option value="avatar" disabled={theme.avatar === 'logo'}>
                    {AVATARS.find((a) => a.key === theme.avatar)?.kind === 'character'
                      ? 'Your character'
                      : 'Bot avatar'}
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

          <fieldset disabled={disabled} className="flex flex-col gap-4">
            <legend className="mb-2 text-sm font-semibold text-gray-900">Home screen</legend>
            <div>
              <label className={labelClass}>Heading</label>
              <input
                value={theme.homeTitle}
                maxLength={80}
                onChange={(e) => setTheme('homeTitle', e.target.value)}
                placeholder="How can we help?"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Line under the heading (optional)</label>
              <input
                value={theme.homeSubtitle}
                maxLength={140}
                onChange={(e) => setTheme('homeSubtitle', e.target.value)}
                placeholder="Ask us anything about our products and orders."
                className={inputClass}
              />
            </div>
            <div>
              <p className={labelClass}>Explore topics</p>
              <p className="mb-2 text-xs text-gray-500">
                Up to 6 cards on the home screen; tapping one asks its title. Leave empty to show the bot&apos;s own
                opening choices.
              </p>
              <div className="flex flex-col gap-2">
                {theme.topics.map((topic, index) => (
                  <div key={index} className="flex flex-wrap gap-2 sm:flex-nowrap">
                    <input
                      value={topic.title}
                      maxLength={40}
                      onChange={(e) => setTopic(index, 'title', e.target.value)}
                      placeholder="Title, e.g. Shipping times"
                      aria-label={`Topic ${index + 1} title`}
                      className={inputClass}
                      required
                    />
                    <input
                      value={topic.subtitle}
                      maxLength={60}
                      onChange={(e) => setTopic(index, 'subtitle', e.target.value)}
                      placeholder="Short hint (optional)"
                      aria-label={`Topic ${index + 1} hint`}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => removeTopic(index)}
                      className={secondaryButtonClass}
                      aria-label={`Remove topic ${index + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              {theme.topics.length < 6 && (
                <button type="button" onClick={addTopic} className={`${secondaryButtonClass} mt-2`}>
                  Add topic
                </button>
              )}
            </div>
            <div>
              <label className={labelClass}>Privacy notice (optional)</label>
              <input
                value={theme.privacyNotice}
                maxLength={200}
                onChange={(e) => setTheme('privacyNotice', e.target.value)}
                placeholder="Leave empty to show none"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-500">Shown above the message box until the visitor dismisses it.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={theme.showPoweredBy}
                onChange={(e) => setTheme('showPoweredBy', e.target.checked)}
                className="size-4 accent-indigo-600"
              />
              Show &quot;Powered by ZenithDesk&quot;
            </label>
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
              One site per line, as its full address. Only these sites can show your widget, so no one who copies the
              snippet can raise tickets in your organization from their own pages.
            </p>
            {!draft.domains.trim() && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
                Your widget won&apos;t load anywhere until you add at least one site here.
              </p>
            )}
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
          <ChatWidgetPreview theme={theme} />
        </div>
      </form>
    </div>
  );
}

export default ChatWidgetSection;

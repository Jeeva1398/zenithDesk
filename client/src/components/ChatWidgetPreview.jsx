import { useState } from 'react';

// Mirrors the widget's own stacks so the preview is what a visitor will see.
const FONT_STACKS = {
  system: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  rounded: "ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif",
};

const SAMPLE_TOPICS = [
  { title: 'Make an enquiry', subtitle: '' },
  { title: 'Report a problem', subtitle: '' },
];

function Avatar({ theme, size = 'size-8' }) {
  if (theme.logoUrl) {
    return <img src={theme.logoUrl} alt="" className={`${size} shrink-0 rounded-full bg-white object-cover`} />;
  }
  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full`}
      style={{ background: theme.primaryTextColor, color: theme.primaryColor }}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-1/2" aria-hidden="true">
        <path d="M12 2a1 1 0 0 1 1 1v1h4a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-3.6l-3.8 3.2A1 1 0 0 1 8 20.4V18H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4V3a1 1 0 0 1 1-1Zm-3 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
      </svg>
    </span>
  );
}

function PoweredBy({ theme }) {
  if (!theme.showPoweredBy) return null;
  return <p className="py-1.5 text-center text-[10px] text-gray-400">⚡ Powered by ZenithDesk</p>;
}

function HomePreview({ theme }) {
  const topics = theme.topics?.length ? theme.topics : SAMPLE_TOPICS;
  return (
    <>
      <div
        className="px-4 pb-10 pt-4"
        style={{
          background: `linear-gradient(160deg, ${theme.primaryColor}, color-mix(in srgb, ${theme.primaryColor} 60%, #000))`,
          color: theme.primaryTextColor,
        }}
      >
        <div className="flex items-center gap-2">
          <Avatar theme={theme} size="size-7" />
          <span className="text-sm font-semibold">{theme.title || 'Support'}</span>
        </div>
        <p className="mt-4 text-lg font-bold leading-snug">{theme.homeTitle || 'How can we help?'}</p>
        {theme.homeSubtitle && <p className="mt-1 text-xs opacity-85">{theme.homeSubtitle}</p>}
        <p className="mt-2 flex items-center gap-1.5 text-[11px] opacity-90">
          <span className="size-1.5 rounded-full bg-emerald-400" /> Replies instantly
        </p>
      </div>
      <div className="-mt-6 px-3">
        <div
          className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2.5 text-xs text-gray-400 shadow-sm"
          style={{ background: theme.panelBackground }}
        >
          {theme.placeholder}
          <span
            className="flex size-6 items-center justify-center rounded-lg text-[11px]"
            style={{ background: theme.primaryColor, color: theme.primaryTextColor }}
          >
            ↑
          </span>
        </div>
      </div>
      <div className="px-3 pb-2 pt-3">
        <p className="mb-1.5 text-[11px] font-semibold" style={{ color: theme.botTextColor }}>
          Explore
        </p>
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {topics.map((topic) => (
            <div key={topic.title} className="flex items-center justify-between px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold" style={{ color: theme.botTextColor }}>
                  {topic.title}
                </p>
                {topic.subtitle && <p className="truncate text-[10px] text-gray-500">{topic.subtitle}</p>}
              </div>
              <span className="text-gray-400">›</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-gray-200 text-[10px]">
        <span className="py-1.5 text-center font-semibold" style={{ color: theme.primaryColor }}>
          Home
        </span>
        <span className="py-1.5 text-center text-gray-500">Messages</span>
      </div>
    </>
  );
}

function ChatPreview({ theme }) {
  const bubble = `${theme.bubbleRadius}px`;
  return (
    <>
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2.5" style={{ color: theme.botTextColor }}>
        <span className="text-gray-400">‹</span>
        <Avatar theme={{ ...theme, primaryTextColor: theme.primaryColor, primaryColor: theme.primaryTextColor }} size="size-7" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
            {theme.title || 'Support'}
            <span
              className="rounded-full px-1.5 text-[9px] font-bold"
              style={{ background: `color-mix(in srgb, ${theme.primaryColor} 15%, transparent)`, color: theme.primaryColor }}
            >
              AI
            </span>
          </p>
          <p className="text-[10px] text-emerald-600">● Online</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 p-3 text-[12px]">
        <div className="flex justify-end">
          <span
            className="max-w-[80%] px-3 py-2"
            style={{ background: theme.primaryColor, color: theme.primaryTextColor, borderRadius: bubble }}
          >
            How long do refunds take?
          </span>
        </div>
        <p className="pl-8 text-[10px] font-semibold text-gray-500">{theme.title || 'Support'} · AI assistant</p>
        <div className="flex items-end gap-1.5">
          <Avatar theme={{ ...theme, primaryTextColor: theme.primaryColor, primaryColor: theme.primaryTextColor }} size="size-6" />
          <span
            className="max-w-[80%] px-3 py-2"
            style={{ background: theme.botBubbleColor, color: theme.botTextColor, borderRadius: bubble }}
          >
            Refunds are issued within <b>7 days</b> of your request.
          </span>
        </div>
        <p className="pl-8 text-[11px] text-gray-400">👍 👎 ⧉</p>
      </div>
      {theme.privacyNotice && (
        <p className="mx-3 mb-2 rounded-lg bg-gray-100 px-2.5 py-1.5 text-[10px] text-gray-600">ⓘ {theme.privacyNotice}</p>
      )}
      <div className="border-t border-gray-200 p-2.5">
        <div className="rounded-xl border border-gray-300 px-3 py-2 text-xs text-gray-400">{theme.placeholder}</div>
      </div>
    </>
  );
}

function ChatWidgetPreview({ theme }) {
  const [view, setView] = useState('home');
  const side = theme.position === 'left' ? 'items-start' : 'items-end';

  return (
    <div>
      <div className="mb-2 flex gap-1 text-xs" role="tablist" aria-label="Preview">
        {['home', 'chat'].map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`rounded-md px-2.5 py-1 font-medium capitalize ${
              view === v ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {v === 'home' ? 'Home screen' : 'Conversation'}
          </button>
        ))}
      </div>
      <div className={`flex flex-col gap-3 rounded-xl bg-gray-100 p-4 ${side}`} style={{ fontFamily: FONT_STACKS[theme.fontFamily] }}>
        <div
          className="w-full max-w-[300px] overflow-hidden border border-black/5 shadow-xl"
          style={{ borderRadius: `${Math.max(theme.cornerRadius, 12)}px`, background: theme.panelBackground }}
        >
          {view === 'home' ? <HomePreview theme={theme} /> : <ChatPreview theme={theme} />}
          <PoweredBy theme={theme} />
        </div>
        <span
          className="flex size-12 items-center justify-center overflow-hidden rounded-full text-xl shadow-md"
          style={{ background: theme.primaryColor, color: theme.primaryTextColor }}
        >
          {theme.launcherIcon === 'logo' && theme.logoUrl ? (
            <img src={theme.logoUrl} alt="" className="size-full object-cover" />
          ) : (
            '⌄'
          )}
        </span>
      </div>
    </div>
  );
}

export default ChatWidgetPreview;

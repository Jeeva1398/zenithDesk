import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getChatSetup } from '../api/chatWidget';
import { getChatbotOverview } from '../api/analytics';
import { useAuth } from '../context/AuthContext';
import { useLiveChat } from '../context/LiveChatContext';
import { cardClass, secondaryButtonClass } from '../lib/ui';

const CHATBOT_URL = (import.meta.env.VITE_CHATBOT_URL || 'http://localhost:4000').replace(/\/$/, '');

// Each step of getting the bot onto a site, worked out by the server from what
// the org has - none of them is ticked by hand. Installing is the one that
// matters, so it is the only one with its own action here.
const STEPS = [
  {
    key: 'branded',
    title: 'Brand the widget',
    description: 'Your logo, colours and greeting, so it looks like part of your site.',
    to: '/settings?tab=chat-widget',
  },
  {
    key: 'purposes',
    title: 'Choose what the bot does',
    description: 'Answer questions, take enquiries, hand chats to your team.',
    to: '/settings?tab=chatbot',
  },
  {
    key: 'knowledge',
    title: 'Add knowledge',
    description: 'Publish at least one article for the bot to answer from.',
    to: '/settings?tab=knowledge',
  },
  {
    key: 'allowedSites',
    title: 'Add your website',
    description: 'The widget only loads on the sites you list.',
    to: '/settings?tab=chat-widget',
  },
  {
    key: 'installed',
    title: 'Install the snippet',
    description: 'Paste it before </body> on your site. This turns green once the widget has loaded there.',
  },
  {
    key: 'teammate',
    title: 'Invite a teammate',
    description: 'Someone to answer live chats and follow up on enquiries.',
    to: '/settings?tab=team',
    optional: true,
  },
];

function CheckIcon({ done }) {
  return done ? (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
        <path
          fillRule="evenodd"
          d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  ) : (
    <span className="size-6 shrink-0 rounded-full border-2 border-gray-300" />
  );
}

function Stat({ label, value, to }) {
  const body = (
    <>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value ?? '–'}</p>
    </>
  );
  return to ? (
    <Link to={to} className={`${cardClass} block p-4 transition hover:border-indigo-300`}>
      {body}
    </Link>
  ) : (
    <div className={`${cardClass} p-4`}>{body}</div>
  );
}

function formatWhen(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function ChatHomePage() {
  const { token, agent } = useAuth();
  const { counts } = useLiveChat();
  const [setup, setSetup] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getChatSetup(token)
      .then(setSetup)
      .catch((err) => setError(err.message));
    // The numbers are a bonus: without them the checklist still works.
    getChatbotOverview(token, 7)
      .then(setStats)
      .catch(() => {});
  }, [token]);

  const snippet = setup ? `<script src="${CHATBOT_URL}/widget.js" data-key="${setup.publicKey}" defer></script>` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy - select the snippet and copy it by hand.');
    }
  };

  const required = STEPS.filter((s) => !s.optional);
  const doneCount = setup ? required.filter((s) => setup.steps[s.key]).length : 0;
  const allDone = setup && doneCount === required.length;
  const today = stats?.trend?.length ? stats.trend[stats.trend.length - 1].conversations : null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {allDone ? 'Your bot is live' : `Welcome${agent?.name ? `, ${agent.name.split(' ')[0]}` : ''}`}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {allDone
            ? 'Here is how it is doing. Everything else lives in Settings.'
            : 'A few steps and your AI assistant is answering on your website.'}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Conversations today" value={today} to="/dashboard?view=chatbot" />
        <Stat label="Conversations, 7 days" value={stats?.totals.conversations} to="/dashboard?view=chatbot" />
        <Stat label="Enquiries, 7 days" value={stats?.totals.enquiries} to="/enquiries" />
        <Stat label="Waiting live chats" value={counts.enabled ? counts.waiting : '–'} to={counts.enabled ? '/live-chats' : undefined} />
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {setup && (
        <section className={`${cardClass} p-5`} aria-labelledby="setup-heading">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="setup-heading" className="text-base font-semibold text-gray-900">
              Set up your bot
            </h2>
            <p className="text-sm text-gray-500">
              {doneCount} of {required.length} done
            </p>
          </div>
          <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(doneCount / required.length) * 100}%` }}
            />
          </div>

          <ol className="divide-y divide-gray-100">
            {STEPS.map((step) => {
              const done = setup.steps[step.key];
              return (
                <li key={step.key} className="flex gap-3 py-3.5" data-step={step.key} data-done={done}>
                  <CheckIcon done={done} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${done ? 'text-gray-500' : 'text-gray-900'}`}>
                      {step.title}
                      {step.optional && <span className="ml-1.5 text-xs font-normal text-gray-400">optional</span>}
                      {step.key === 'installed' && done && (
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Installed ✓
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {step.key === 'installed' && done
                        ? `Last seen on ${setup.install.lastSeenOrigin}, ${formatWhen(setup.install.lastSeenAt)}.`
                        : step.description}
                    </p>

                    {step.key === 'installed' && !done && (
                      <div className="mt-3">
                        <pre className="overflow-x-auto rounded-lg bg-[#0E0B30] p-3 text-xs text-[#E4E2F5] ring-1 ring-white/10">
                          <code>{snippet}</code>
                        </pre>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <button type="button" onClick={handleCopy} className={secondaryButtonClass}>
                            {copied ? 'Copied' : 'Copy snippet'}
                          </button>
                          {!setup.steps.allowedSites && (
                            <p className="text-xs text-amber-700">Add your website first, or the widget will not load.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {step.to && !done && (
                    <Link to={step.to} className="shrink-0 self-center text-sm font-medium text-indigo-600 hover:text-indigo-700">
                      Set up
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

export default ChatHomePage;

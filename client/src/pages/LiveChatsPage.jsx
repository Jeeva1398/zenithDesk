import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  closeLiveChat,
  getLiveChat,
  joinLiveChat,
  listLiveChatMessages,
  listLiveChats,
  sendLiveChatMessage,
} from '../api/liveChats';
import { useAuth } from '../context/AuthContext';
import { useLiveChat } from '../context/LiveChatContext';
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '../lib/ui';

// The list and the open chat are polled rather than pushed: a few seconds is
// fast enough for a conversation, and it keeps the API a plain request/response
// one behind the same proxy as everything else.
const LIST_POLL_MS = 5000;
const CHAT_POLL_MS = 2500;

const STATUS_STYLES = {
  waiting: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  closed: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  missed: 'bg-amber-50 text-amber-700 ring-amber-600/20',
};

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function visitorLabel(chat) {
  return chat.visitorName || chat.visitorEmail || `Visitor #${chat.id}`;
}

function sinceLabel(value, now) {
  const minutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString(undefined, { timeStyle: 'short' });
}

// Ticks once a minute so "waiting 3m" stays true without a refetch.
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function ChatListItem({ chat, selected, onSelect, now }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(chat.id)}
      aria-current={selected ? 'true' : undefined}
      className={`flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition ${
        selected ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : 'hover:bg-gray-50'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-gray-900">{visitorLabel(chat)}</span>
        <span className="shrink-0 text-xs text-gray-400">
          {sinceLabel(chat.status === 'waiting' ? chat.createdAt : chat.lastMessageAt || chat.createdAt, now)}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <StatusBadge status={chat.status} />
        <span className="truncate text-xs text-gray-500">
          {chat.status === 'active' && chat.agent ? chat.agent.name : chat.lastMessage || 'No messages yet'}
        </span>
      </span>
    </button>
  );
}

function ChatList({ data, selectedId, onSelect }) {
  const now = useNow();
  const waiting = data.open.filter((c) => c.status === 'waiting');
  const active = data.open.filter((c) => c.status === 'active');

  const section = (title, chats, empty) => (
    <div>
      <h2 className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title} {chats.length > 0 && <span className="text-gray-300">· {chats.length}</span>}
      </h2>
      {chats.length === 0 ? (
        <p className="px-3 py-2 text-sm text-gray-400">{empty}</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {chats.map((chat) => (
            <ChatListItem key={chat.id} chat={chat} selected={chat.id === selectedId} onSelect={onSelect} now={now} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-1 p-2">
      {section('Waiting', waiting, 'No one is waiting.')}
      {section('Active', active, 'No chats in progress.')}
      {section('Recent', data.recent, 'Finished chats show here.')}
    </div>
  );
}

function Bubble({ message }) {
  if (message.authorType === 'system') {
    return (
      <p className="mx-auto my-1 rounded-full bg-gray-100 px-3 py-1 text-center text-xs text-gray-500">{message.body}</p>
    );
  }
  const mine = message.authorType === 'agent';
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <span className="mb-0.5 px-1 text-xs text-gray-400">
        {mine ? message.authorName : 'Visitor'} · {formatTime(message.createdAt)}
      </span>
      <p
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
          mine ? 'rounded-br-md bg-indigo-600 text-white' : 'rounded-bl-md bg-gray-100 text-gray-900'
        }`}
      >
        {message.body}
      </p>
    </div>
  );
}

// What the visitor said to the bot before asking for a person, so the agent
// does not have to ask again.
function BotTranscript({ transcript }) {
  const [open, setOpen] = useState(true);
  if (!transcript?.length) return null;
  return (
    <div className="rounded-lg border border-dashed border-gray-300">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-500"
      >
        Conversation with the bot ({transcript.length} messages)
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-dashed border-gray-300 px-3 py-3">
          {transcript.map((entry, index) => (
            <p key={index} className="text-sm text-gray-600">
              <span className="font-medium text-gray-500">{entry.role === 'user' ? 'Visitor' : 'Bot'}:</span>{' '}
              <span className="whitespace-pre-wrap">{entry.content}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatPanel({ chatId, onChanged }) {
  const { token, agent } = useAuth();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lastIdRef = useRef(0);
  const bottomRef = useRef(null);

  const appendMessages = useCallback((incoming) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      return [...prev, ...incoming.filter((m) => !known.has(m.id))];
    });
    lastIdRef.current = Math.max(lastIdRef.current, ...incoming.map((m) => m.id));
  }, []);

  const pull = useCallback(async () => {
    const result = await listLiveChatMessages(token, chatId, lastIdRef.current);
    setChat((current) => (current ? { ...current, ...result.chat } : current));
    appendMessages(result.messages);
    return result;
  }, [token, chatId, appendMessages]);

  useEffect(() => {
    let cancelled = false;
    lastIdRef.current = 0;
    setChat(null);
    setMessages([]);
    setError('');
    setDraft('');

    getLiveChat(token, chatId)
      .then((loaded) => {
        if (cancelled) return;
        setChat(loaded);
        return pull();
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    const timer = setInterval(() => {
      pull().catch(() => {
        // Retried on the next tick.
      });
    }, CHAT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token, chatId, pull]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (error && !chat) {
    return <p className="p-6 text-sm text-red-600">{error}</p>;
  }
  if (!chat) {
    return <p className="p-6 text-sm text-gray-500">Loading chat…</p>;
  }

  const open = chat.status === 'waiting' || chat.status === 'active';
  const mine = chat.status === 'active' && chat.agent?.id === agent?.id;
  const someoneElse = chat.status === 'active' && !mine;

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      const updated = await action();
      if (updated) setChat((current) => ({ ...current, ...updated }));
      await pull();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async (event) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    await run(async () => {
      const updated = await sendLiveChatMessage(token, chat.id, text);
      setDraft('');
      return updated;
    });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-gray-900">{visitorLabel(chat)}</h2>
            <StatusBadge status={chat.status} />
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            Started {new Date(chat.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            {chat.agent && ` · ${chat.agent.name}`}
          </p>
        </div>
        {open && (
          <div className="flex gap-2">
            {!mine && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => joinLiveChat(token, chat.id))}
                className={primaryButtonClass}
              >
                {someoneElse ? 'Take over' : 'Join chat'}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => closeLiveChat(token, chat.id))}
              className={secondaryButtonClass}
            >
              End chat
            </button>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        <BotTranscript transcript={chat.transcript} />
        {messages.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mx-5 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {open ? (
        <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-gray-200 px-5 py-3">
          <textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={5000}
            disabled={busy || someoneElse}
            placeholder={
              someoneElse
                ? `${chat.agent.name} is handling this chat - take it over to reply`
                : chat.status === 'waiting'
                  ? 'Reply to join the chat'
                  : 'Type a reply - Enter to send, Shift+Enter for a new line'
            }
            aria-label="Reply"
            className={`${inputClass} resize-none`}
          />
          <button type="submit" disabled={busy || someoneElse || !draft.trim()} className={primaryButtonClass}>
            Send
          </button>
        </form>
      ) : (
        <p className="border-t border-gray-200 px-5 py-3 text-sm text-gray-500">
          This chat has {chat.status === 'missed' ? 'been missed' : 'ended'}. The visitor is back with the bot.
        </p>
      )}
    </div>
  );
}

function LiveChatsPage() {
  const { token } = useAuth();
  const { counts, refresh: refreshCounts } = useLiveChat();
  const [params, setParams] = useSearchParams();
  const selectedId = Number(params.get('open')) || null;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    listLiveChats(token)
      .then((result) => {
        setData(result);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, [token]);

  useEffect(() => {
    load();
    const timer = setInterval(load, LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const select = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set('open', String(id));
    else next.delete('open');
    setParams(next, { replace: true });
  };

  const handleChanged = () => {
    load();
    refreshCounts();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Live chat</h1>
          <p className="mt-1 text-sm text-gray-500">Visitors who asked the chat widget for a person</p>
        </div>
        {counts.enabled && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
            You&apos;re available while the portal is open
            {counts.online > 1 && ` · ${counts.online} agents online`}
          </p>
        )}
      </div>

      {!counts.enabled && data && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Handing chats to people is turned off, so the bot will not offer it.{' '}
          <Link to="/settings?tab=chatbot" className="font-medium underline">
            Turn it on in Settings
          </Link>
          .
        </div>
      )}

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!data && !error && <p className="py-16 text-center text-sm text-gray-500">Loading live chats…</p>}

      {data && (
        <div className={`${cardClass} grid overflow-hidden lg:h-[calc(100vh-13rem)] lg:grid-cols-[20rem_1fr]`}>
          <div
            className={`overflow-y-auto border-gray-200 lg:border-r ${selectedId ? 'hidden lg:block' : ''}`}
          >
            <ChatList data={data} selectedId={selectedId} onSelect={select} />
          </div>
          <div className={`min-h-[28rem] ${selectedId ? '' : 'hidden lg:block'}`}>
            {selectedId ? (
              <div className="flex h-full flex-col">
                <button
                  type="button"
                  onClick={() => select(null)}
                  className="border-b border-gray-200 px-5 py-2 text-left text-sm font-medium text-indigo-600 lg:hidden"
                >
                  ← All chats
                </button>
                <div className="min-h-0 flex-1">
                  <ChatPanel key={selectedId} chatId={selectedId} onChanged={handleChanged} />
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-10 text-center text-sm text-gray-500">
                {data.open.length > 0 ? 'Pick a chat to open it.' : 'No one is waiting. New chats appear here as visitors ask for a person.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveChatsPage;

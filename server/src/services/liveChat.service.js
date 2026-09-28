const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');
const chatWidgetService = require('./chatWidget.service');

// Chats the bot has handed to a person. The chat server opens one when a
// visitor asks for someone, relays what the visitor types, and polls for the
// agent's replies; agents work them from the Live chat page.

const OPEN_STATUSES = ['waiting', 'active'];
const STATUSES = [...OPEN_STATUSES, 'closed', 'missed'];
const MAX_BODY = 5000;
const MAX_TRANSCRIPT_MESSAGES = 50;
const RECENT_LIMIT = 20;
const MESSAGE_PAGE = 200;

// Who has the portal open, per org: the portal checks in every few seconds
// (the Live chat counts behind the sidebar badge), and an agent counts as
// available for a while after. Long enough to cover a portal left in a
// background tab, whose timers the browser slows to about once a minute. Held
// in memory, since it only has to survive between two check-ins; after a
// restart it fills again within one.
const PRESENCE_WINDOW_MS = 90 * 1000;
const presence = new Map();

function markAgentSeen(orgId, agentId) {
  if (!presence.has(orgId)) presence.set(orgId, new Map());
  presence.get(orgId).set(agentId, Date.now());
}

function agentsOnline(orgId) {
  const seen = presence.get(orgId);
  if (!seen) return 0;
  const cutoff = Date.now() - PRESENCE_WINDOW_MS;
  let count = 0;
  for (const [agentId, at] of seen) {
    if (at >= cutoff) count += 1;
    else seen.delete(agentId);
  }
  return count;
}

function requireText(value, field, max) {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(400, `${field} is required`);
  const text = value.trim();
  if (text.length > max) throw new ApiError(400, `${field} must be at most ${max} characters`);
  return text;
}

function optionalText(value, field, max) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new ApiError(400, `${field} must be text`);
  return value.trim().slice(0, max) || null;
}

function sanitizeTranscript(input) {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new ApiError(400, 'transcript must be a list');
  return input.slice(-MAX_TRANSCRIPT_MESSAGES).map((entry) => {
    if (!entry || !['user', 'assistant'].includes(entry.role) || typeof entry.content !== 'string') {
      throw new ApiError(400, 'transcript entries need a role (user or assistant) and content');
    }
    return { role: entry.role, content: entry.content.slice(0, MAX_BODY) };
  });
}

async function handoffSettings(orgId) {
  return (await chatWidgetService.getBotSettings(orgId)).handoff;
}

const CHAT_COLUMNS = `c.id, c.session_id, c.status, c.agent_id, a.name AS agent_name, c.visitor_name,
  c.visitor_email, c.last_message_at, c.closed_at, c.created_at, c.updated_at`;

function presentChat(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    status: row.status,
    agent: row.agent_id ? { id: row.agent_id, name: row.agent_name } : null,
    visitorName: row.visitor_name,
    visitorEmail: row.visitor_email,
    lastMessageAt: row.last_message_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    ...(row.last_body !== undefined ? { lastMessage: row.last_body } : {}),
  };
}

function presentMessage(row) {
  return {
    id: row.id,
    authorType: row.author_type,
    authorName: row.agent_name || (row.author_type === 'agent' ? 'Agent' : null),
    body: row.body,
    event: row.event,
    createdAt: row.created_at,
  };
}

async function findChat(db, id) {
  const rows = await db.sql(
    `SELECT ${CHAT_COLUMNS}, c.transcript FROM live_chats c
     LEFT JOIN agents a ON a.id = c.agent_id AND a.org_id = c.org_id
     WHERE c.org_id = :orgId AND c.id = ?`,
    [Number(id) || 0],
  );
  if (!rows[0]) throw new ApiError(404, 'Live chat not found');
  return rows[0];
}

// The service token acts for every conversation on a widget, so on top of the
// org scope a chat is only reachable with the session it was opened for.
function assertSession(chat, sessionId) {
  if (sessionId !== undefined && chat.session_id !== sessionId) {
    throw new ApiError(404, 'Live chat not found');
  }
}

async function addMessage(db, chatId, { authorType, agentId = null, body, event = null }) {
  await db.insert('live_chat_messages', {
    live_chat_id: chatId,
    author_type: authorType,
    agent_id: agentId,
    body,
    event,
  });
  await db.sql('UPDATE live_chats SET last_message_at = NOW() WHERE org_id = :orgId AND id = ?', [chatId]);
}

// A chat nobody joined in time is marked missed on the next read of it, so
// whichever side looks first - the widget polling or an agent's list - sees
// the same outcome, and nothing has to run on a timer. The clock is the
// database's, the same one that stamped created_at.
async function expireUnanswered(db, waitMinutes, chatId = null) {
  const expired = await db.sql(
    `SELECT id FROM live_chats WHERE org_id = :orgId AND status = 'waiting'
     AND created_at < NOW() - INTERVAL ? MINUTE${chatId ? ' AND id = ?' : ''}`,
    chatId ? [waitMinutes, chatId] : [waitMinutes],
  );
  for (const { id } of expired) {
    const result = await db.sql(
      `UPDATE live_chats SET status = 'missed', closed_at = NOW(), updated_at = NOW()
       WHERE org_id = :orgId AND id = ? AND status = 'waiting'`,
      [id],
    );
    if (result.affectedRows) {
      await addMessage(db, id, {
        authorType: 'system',
        body: 'No one joined in time. The visitor was handed back to the bot.',
        event: 'missed',
      });
    }
  }
}

async function setStatus(db, chatId, status, { agentId } = {}) {
  const closing = status === 'closed' || status === 'missed';
  await db.sql(
    `UPDATE live_chats SET status = ?${agentId ? ', agent_id = ?' : ''}${closing ? ', closed_at = NOW()' : ''},
     updated_at = NOW() WHERE org_id = :orgId AND id = ?`,
    agentId ? [status, agentId, chatId] : [status, chatId],
  );
}

// Opened by the chat server. One open chat per conversation: asking again
// while waiting gives back the same one. Refused when no agent has the portal
// open, so the bot can say so at once instead of leaving the visitor waiting
// on nobody.
async function openChat(orgId, input) {
  const handoff = await handoffSettings(orgId);
  if (!handoff.enabled) throw new ApiError(409, 'This organization does not hand chats to people');

  const sessionId = requireText(input.sessionId, 'sessionId', 100);
  const db = forOrg(orgId);

  const open = await db.sql(
    `SELECT id FROM live_chats WHERE org_id = :orgId AND session_id = ? AND status IN ('waiting', 'active')
     ORDER BY id DESC LIMIT 1`,
    [sessionId],
  );
  if (open[0]) return getChat(orgId, open[0].id);

  if (agentsOnline(orgId) === 0) throw new ApiError(503, 'No one is available to chat right now');

  const id = await db.insert('live_chats', {
    session_id: sessionId,
    status: 'waiting',
    visitor_name: optionalText(input.visitorName, 'visitorName', 100),
    visitor_email: optionalText(input.visitorEmail, 'visitorEmail', 255),
    transcript: JSON.stringify(sanitizeTranscript(input.transcript)),
  });
  await db.sql('UPDATE live_chats SET last_message_at = NOW() WHERE org_id = :orgId AND id = ?', [id]);
  return getChat(orgId, id);
}

async function getChat(orgId, id) {
  const db = forOrg(orgId);
  const { waitMinutes } = await handoffSettings(orgId);
  await expireUnanswered(db, waitMinutes, (await findChat(db, id)).id);
  const chat = await findChat(db, id);
  let transcript;
  try {
    transcript = JSON.parse(chat.transcript || '[]');
  } catch {
    transcript = [];
  }
  return { ...presentChat(chat), transcript };
}

async function listMessages(orgId, id, { after, sessionId } = {}) {
  const db = forOrg(orgId);
  const { waitMinutes } = await handoffSettings(orgId);
  const found = await findChat(db, id);
  assertSession(found, sessionId);
  await expireUnanswered(db, waitMinutes, found.id);
  const chat = await findChat(db, id);

  const afterId = Number(after) || 0;
  const rows = await db.sql(
    `SELECT m.id, m.author_type, m.body, m.event, m.created_at, a.name AS agent_name FROM live_chat_messages m
     LEFT JOIN agents a ON a.id = m.agent_id AND a.org_id = m.org_id
     WHERE m.org_id = :orgId AND m.live_chat_id = ? AND m.id > ?
     ORDER BY m.id ASC LIMIT ?`,
    [chat.id, afterId, MESSAGE_PAGE],
  );
  return { chat: presentChat(chat), messages: rows.map(presentMessage) };
}

async function addVisitorMessage(orgId, id, { sessionId, body }) {
  const db = forOrg(orgId);
  const chat = await findChat(db, id);
  assertSession(chat, sessionId);
  if (!OPEN_STATUSES.includes(chat.status)) throw new ApiError(409, 'This chat has ended');
  await addMessage(db, chat.id, { authorType: 'visitor', body: requireText(body, 'body', MAX_BODY) });
  return listMessages(orgId, id, { after: Number.MAX_SAFE_INTEGER });
}

// Taking a waiting chat, or taking over one a colleague has. Either way the
// visitor is told who they are talking to now.
async function joinChat(orgId, id, agent) {
  const db = forOrg(orgId);
  const { waitMinutes } = await handoffSettings(orgId);
  await expireUnanswered(db, waitMinutes, (await findChat(db, id)).id);
  const chat = await findChat(db, id);
  if (!OPEN_STATUSES.includes(chat.status)) throw new ApiError(409, 'This chat has ended');
  if (chat.status === 'active' && chat.agent_id === agent.id) return getChat(orgId, id);

  await setStatus(db, chat.id, 'active', { agentId: agent.id });
  const [me] = await db.sql('SELECT name FROM agents WHERE org_id = :orgId AND id = ?', [agent.id]);
  await addMessage(db, chat.id, {
    authorType: 'system',
    agentId: agent.id,
    body: `${me?.name || 'An agent'} joined the chat`,
    event: 'joined',
  });
  return getChat(orgId, id);
}

// An agent replying to a waiting chat takes it; one someone else has needs
// taking over first, so two people never answer the same visitor unawares.
async function addAgentMessage(orgId, id, agent, { body }) {
  const text = requireText(body, 'body', MAX_BODY);
  const db = forOrg(orgId);
  let chat = await findChat(db, id);
  if (chat.status === 'waiting') {
    await joinChat(orgId, id, agent);
    chat = await findChat(db, id);
  }
  if (!OPEN_STATUSES.includes(chat.status)) throw new ApiError(409, 'This chat has ended');
  if (chat.agent_id !== agent.id) {
    throw new ApiError(409, `${chat.agent_name || 'Another agent'} is handling this chat - take it over to reply`);
  }
  await addMessage(db, chat.id, { authorType: 'agent', agentId: agent.id, body: text });
  return getChat(orgId, id);
}

// Ended by an agent, or by the visitor through the chat server. A visitor
// leaving before anyone joined counts as missed.
async function closeChat(orgId, id, { agent = null, sessionId } = {}) {
  const db = forOrg(orgId);
  const chat = await findChat(db, id);
  assertSession(chat, sessionId);
  if (!OPEN_STATUSES.includes(chat.status)) return getChat(orgId, id);

  const status = !agent && chat.status === 'waiting' ? 'missed' : 'closed';
  await setStatus(db, chat.id, status);

  let body = 'The visitor ended the chat';
  if (agent) {
    const [me] = await db.sql('SELECT name FROM agents WHERE org_id = :orgId AND id = ?', [agent.id]);
    body = `${me?.name || 'An agent'} ended the chat`;
  }
  await addMessage(db, chat.id, {
    authorType: 'system',
    agentId: agent ? agent.id : null,
    body,
    event: status === 'missed' ? 'missed' : 'ended',
  });
  return getChat(orgId, id);
}

// Open chats oldest first, so the longest wait is at the top, then the most
// recent finished ones.
async function listChats(orgId) {
  const db = forOrg(orgId);
  const { waitMinutes } = await handoffSettings(orgId);

  await expireUnanswered(db, waitMinutes);

  const lastBody = `(SELECT m.body FROM live_chat_messages m
    WHERE m.org_id = c.org_id AND m.live_chat_id = c.id AND m.author_type <> 'system'
    ORDER BY m.id DESC LIMIT 1) AS last_body`;
  const open = await db.sql(
    `SELECT ${CHAT_COLUMNS}, ${lastBody} FROM live_chats c
     LEFT JOIN agents a ON a.id = c.agent_id AND a.org_id = c.org_id
     WHERE c.org_id = :orgId AND c.status IN ('waiting', 'active')
     ORDER BY c.status = 'active', c.created_at ASC`,
  );
  const recent = await db.sql(
    `SELECT ${CHAT_COLUMNS}, ${lastBody} FROM live_chats c
     LEFT JOIN agents a ON a.id = c.agent_id AND a.org_id = c.org_id
     WHERE c.org_id = :orgId AND c.status IN ('closed', 'missed')
     ORDER BY c.closed_at DESC, c.id DESC LIMIT ?`,
    [RECENT_LIMIT],
  );
  return { open: open.map(presentChat), recent: recent.map(presentChat) };
}

// What the sidebar badge polls. It doubles as the agent's check-in, which is
// what "someone is available" means when a visitor asks for a person.
async function counts(orgId, agentId) {
  const handoff = await handoffSettings(orgId);
  if (!handoff.enabled) return { enabled: false, waiting: 0, active: 0, online: 0 };

  markAgentSeen(orgId, agentId);
  const db = forOrg(orgId);
  await expireUnanswered(db, handoff.waitMinutes);

  const rows = await db.sql(
    "SELECT status, COUNT(*) AS n FROM live_chats WHERE org_id = :orgId AND status IN ('waiting', 'active') GROUP BY status",
  );
  const result = { enabled: true, waiting: 0, active: 0, online: agentsOnline(orgId) };
  for (const row of rows) result[row.status] = Number(row.n);
  return result;
}

module.exports = {
  STATUSES,
  openChat,
  getChat,
  listMessages,
  addVisitorMessage,
  addAgentMessage,
  joinChat,
  closeChat,
  listChats,
  counts,
  markAgentSeen,
};

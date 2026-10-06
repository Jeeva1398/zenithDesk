const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');
const knowledgeService = require('./knowledge.service');

// The Chatbot tab on the dashboard. The chat server reports what happens in
// its conversations as events; live chats are this app's own records. Read
// straight from the operational tables rather than the warehouse, since the
// volume is small and the numbers should be current.

const EVENT_TYPES = [
  'conversation',
  'kb_answered',
  'kb_helpful',
  'kb_not_helpful',
  'kb_no_answer',
  'ticket',
  'enquiry',
  'handoff',
  'rating_up',
  'rating_down',
  'rating_cleared',
];
const MAX_EVENTS = 100;
const MAX_DETAIL = 255;
const GAP_LIMIT = 10;

function sanitizeEvents(input) {
  if (!Array.isArray(input) || input.length === 0) throw new ApiError(400, 'events must be a non-empty list');
  if (input.length > MAX_EVENTS) throw new ApiError(400, `At most ${MAX_EVENTS} events at a time`);
  return input.map((event) => {
    if (!event || typeof event !== 'object') throw new ApiError(400, 'Each event must be an object');
    if (!EVENT_TYPES.includes(event.type)) throw new ApiError(400, `Unknown event type: ${event.type}`);
    if (typeof event.sessionId !== 'string' || !event.sessionId || event.sessionId.length > 100) {
      throw new ApiError(400, 'Each event needs a sessionId');
    }
    const detail = typeof event.detail === 'string' ? event.detail.trim().slice(0, MAX_DETAIL) || null : null;
    return { session_id: event.sessionId, type: event.type, detail };
  });
}

async function recordEvents(orgId, input) {
  const events = sanitizeEvents(input);
  const db = forOrg(orgId);
  for (const event of events) await db.insert('chatbot_events', event);
  return { recorded: events.length };
}

// Every day in the range, today included, so the chart draws a continuous
// line with zeros where nothing happened.
function fillDays(rows, days) {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const series = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCDate(cursor.getUTCDate() - (days - 1));
  for (let i = 0; i < days; i += 1) {
    const date = cursor.toISOString().slice(0, 10);
    const row = byDate.get(date);
    series.push({
      date,
      conversations: row ? Number(row.conversations) : 0,
      escalated: row ? Number(row.escalated) : 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return series;
}

function share(part, whole) {
  return whole > 0 ? part / whole : null;
}

async function getOverview(orgId, days) {
  const db = forOrg(orgId);
  // From the start of the first day shown.
  const since = 'DATE_SUB(CURDATE(), INTERVAL ? DAY)';
  const back = days - 1;

  const typeRows = await db.sql(
    `SELECT type, COUNT(*) AS n, COUNT(DISTINCT session_id) AS sessions FROM chatbot_events
     WHERE org_id = :orgId AND created_at >= ${since} GROUP BY type`,
    [back],
  );
  const count = {};
  const sessions = {};
  for (const row of typeRows) {
    count[row.type] = Number(row.n);
    sessions[row.type] = Number(row.sessions);
  }

  // Conversations that ended up with a ticket or a person: what the bot did
  // not settle on its own.
  const [escalatedRow] = await db.sql(
    `SELECT COUNT(DISTINCT c.session_id) AS n FROM chatbot_events c
     WHERE c.org_id = :orgId AND c.type = 'conversation' AND c.created_at >= ${since}
       AND EXISTS (SELECT 1 FROM chatbot_events e WHERE e.org_id = c.org_id AND e.session_id = c.session_id
                   AND e.type IN ('ticket', 'handoff'))`,
    [back],
  );
  const conversations = sessions.conversation || 0;
  const escalated = Number(escalatedRow.n);

  // A rating can be changed or taken back, so only the latest one for each
  // reply counts.
  const ratingRows = await db.sql(
    `SELECT e.type, COUNT(*) AS n FROM chatbot_events e
     JOIN (SELECT MAX(id) AS id FROM chatbot_events
           WHERE org_id = :orgId AND type IN ('rating_up', 'rating_down', 'rating_cleared') AND created_at >= ${since}
           GROUP BY session_id, detail) latest ON latest.id = e.id
     WHERE e.org_id = :orgId GROUP BY e.type`,
    [back],
  );
  const ratings = { up: 0, down: 0 };
  for (const row of ratingRows) {
    if (row.type === 'rating_up') ratings.up = Number(row.n);
    if (row.type === 'rating_down') ratings.down = Number(row.n);
  }

  const trend = await db.sql(
    `SELECT DATE_FORMAT(c.created_at, '%Y-%m-%d') AS date, COUNT(DISTINCT c.session_id) AS conversations,
       COUNT(DISTINCT CASE WHEN EXISTS (
         SELECT 1 FROM chatbot_events e WHERE e.org_id = c.org_id AND e.session_id = c.session_id
         AND e.type IN ('ticket', 'handoff')) THEN c.session_id END) AS escalated
     FROM chatbot_events c
     WHERE c.org_id = :orgId AND c.type = 'conversation' AND c.created_at >= ${since}
     GROUP BY date ORDER BY date`,
    [back],
  );

  // Questions the knowledge base could not answer, or answered without
  // helping: what is worth writing an article about.
  const gaps = await db.sql(
    `SELECT MAX(e.detail) AS question, COUNT(*) AS n,
       SUM(e.type = 'kb_no_answer') AS unanswered, MAX(e.created_at) AS last_asked
     FROM chatbot_events e
     WHERE e.org_id = :orgId AND e.detail IS NOT NULL AND e.created_at >= ${since}
       AND (e.type = 'kb_no_answer' OR (e.type = 'kb_answered' AND EXISTS (
         SELECT 1 FROM chatbot_events f WHERE f.org_id = e.org_id AND f.session_id = e.session_id
         AND f.type = 'kb_not_helpful')))
     GROUP BY LOWER(e.detail) ORDER BY n DESC, question ASC LIMIT ?`,
    [back, GAP_LIMIT],
  );

  const [liveRow] = await db.sql(
    `SELECT COUNT(*) AS total,
       SUM(c.agent_id IS NOT NULL) AS answered,
       SUM(c.status = 'missed') AS missed,
       AVG((SELECT TIMESTAMPDIFF(SECOND, c.created_at, MIN(m.created_at)) FROM live_chat_messages m
            WHERE m.org_id = c.org_id AND m.live_chat_id = c.id AND m.event = 'joined')) AS wait_seconds
     FROM live_chats c WHERE c.org_id = :orgId AND c.created_at >= ${since}`,
    [back],
  );

  // Whether an article written since a question was last asked now covers
  // it. Worked out per question with the chatbot's own search; a failure
  // costs only the hint, never the dashboard.
  const newerArticles = await Promise.all(
    gaps.map((row) => knowledgeService.newerArticleFor(orgId, row.question, row.last_asked).catch(() => null)),
  );

  const kbAnswered = count.kb_answered || 0;
  return {
    range: { days },
    totals: {
      conversations,
      handledByBot: conversations - escalated,
      handledByBotRate: share(conversations - escalated, conversations),
      tickets: count.ticket || 0,
      enquiries: count.enquiry || 0,
      handoffs: count.handoff || 0,
    },
    knowledge: {
      answered: kbAnswered,
      helpful: count.kb_helpful || 0,
      notHelpful: count.kb_not_helpful || 0,
      noAnswer: count.kb_no_answer || 0,
      helpfulRate: share(count.kb_helpful || 0, (count.kb_helpful || 0) + (count.kb_not_helpful || 0)),
    },
    ratings: { ...ratings, satisfaction: share(ratings.up, ratings.up + ratings.down) },
    liveChats: {
      total: Number(liveRow.total),
      answered: Number(liveRow.answered || 0),
      missed: Number(liveRow.missed || 0),
      avgWaitSeconds: liveRow.wait_seconds === null ? null : Number(liveRow.wait_seconds),
    },
    trend: fillDays(trend, days),
    knowledgeGaps: gaps.map((row, i) => ({
      question: row.question,
      count: Number(row.n),
      unanswered: Number(row.unanswered),
      lastAsked: row.last_asked,
      coveredBy: newerArticles[i],
    })),
  };
}

module.exports = { EVENT_TYPES, recordEvents, getOverview };

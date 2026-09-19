const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');

async function addComment(orgId, ticketId, agentId, body) {
  if (!body) {
    throw new ApiError(400, 'body is required');
  }

  const db = forOrg(orgId);
  await db.get('tickets', ticketId, 'Ticket not found', { columns: 'id' });

  const commentId = await db.insert('ticket_comments', {
    ticket_id: ticketId,
    author_agent_id: agentId,
    body,
  });

  return db.get('ticket_comments', commentId, 'Comment not found');
}

module.exports = { addComment };

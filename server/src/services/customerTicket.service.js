const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

async function getCustomerId(db, email) {
  const customer = await db.get('users', { email }, 'Customer not found', { columns: 'id' });
  return customer.id;
}

// An address with no customer row has no tickets rather than being an error,
// which is what the JOIN this replaced did.
async function listTickets(orgId, email) {
  const db = forOrg(orgId);
  const customer = await db.find('users', { email }, { columns: 'id' });
  if (!customer) {
    return [];
  }
  return db.list('tickets', { customer_id: customer.id }, { orderBy: 'created_at DESC' });
}

async function getTicketById(orgId, email, ticketId) {
  const db = forOrg(orgId);
  const customer = await db.find('users', { email }, { columns: 'id' });

  const ticket = customer
    ? await db.find('tickets', { id: ticketId, customer_id: customer.id })
    : null;
  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  const comments = await db.sql(
    `SELECT tc.*,
       CASE WHEN tc.author_agent_id IS NOT NULL THEN 'agent' ELSE 'customer' END AS author_type,
       COALESCE(a.name, u.name) AS author_name
     FROM ticket_comments tc
     LEFT JOIN agents a ON a.id = tc.author_agent_id AND a.org_id = :orgId
     LEFT JOIN users u ON u.id = tc.author_customer_id AND u.org_id = :orgId
     WHERE tc.ticket_id = ? AND tc.org_id = :orgId
     ORDER BY tc.created_at ASC`,
    [ticket.id],
  );

  return { ...ticket, comments };
}

async function createTicket(orgId, email, data) {
  const { subject, description, category, priority } = data;

  if (!subject || !description) {
    throw new ApiError(400, 'subject and description are required');
  }
  if (priority && !PRIORITIES.includes(priority)) {
    throw new ApiError(400, `priority must be one of: ${PRIORITIES.join(', ')}`);
  }

  const db = forOrg(orgId);
  const ticketId = await db.insert('tickets', {
    customer_id: await getCustomerId(db, email),
    subject,
    description,
    category: category || null,
    priority: priority || 'medium',
  });

  return getTicketById(orgId, email, ticketId);
}

async function addComment(orgId, email, ticketId, body) {
  if (!body) {
    throw new ApiError(400, 'body is required');
  }

  const db = forOrg(orgId);
  const customerId = await getCustomerId(db, email);

  await db.get('tickets', { id: ticketId, customer_id: customerId }, 'Ticket not found', {
    columns: 'id',
  });

  const commentId = await db.insert('ticket_comments', {
    ticket_id: ticketId,
    author_customer_id: customerId,
    body,
  });

  return db.get('ticket_comments', commentId, 'Comment not found');
}

module.exports = { listTickets, getTicketById, createTicket, addComment };

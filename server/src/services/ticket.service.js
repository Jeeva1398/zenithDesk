const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['open', 'pending', 'resolved', 'closed'];

async function findOrCreateCustomer(db, { customerName, customerEmail }) {
  const existing = await db.find('users', { email: customerEmail }, { columns: 'id' });
  if (existing) {
    return existing.id;
  }
  return db.insert('users', { name: customerName, email: customerEmail });
}

async function findOrCreateTag(db, name) {
  const existing = await db.find('tags', { name }, { columns: 'id' });
  if (existing) {
    return existing.id;
  }
  return db.insert('tags', { name });
}

// ticket_tags has no org_id of its own — a row is reachable only through a
// ticket, so the scoping comes from the caller having already proved the
// ticket belongs to this org.
async function syncTicketTags(db, ticketId, tagNames) {
  const names = [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))];
  const tagIds = await Promise.all(names.map((name) => findOrCreateTag(db, name)));

  await db.sql('DELETE FROM ticket_tags WHERE ticket_id = ?', [ticketId]);
  if (tagIds.length > 0) {
    await db.sql('INSERT INTO ticket_tags (ticket_id, tag_id) VALUES ?', [
      tagIds.map((tagId) => [ticketId, tagId]),
    ]);
  }
}

async function getTicketTags(db, ticketId) {
  const rows = await db.sql(
    `SELECT tags.name FROM ticket_tags
     JOIN tags ON tags.id = ticket_tags.tag_id AND tags.org_id = :orgId
     WHERE ticket_tags.ticket_id = ?
     ORDER BY tags.name ASC`,
    [ticketId],
  );
  return rows.map((row) => row.name);
}

async function attachTagsToTickets(db, tickets) {
  if (tickets.length === 0) {
    return {};
  }

  const rows = await db.sql(
    `SELECT ticket_tags.ticket_id, tags.name FROM ticket_tags
     JOIN tags ON tags.id = ticket_tags.tag_id AND tags.org_id = :orgId
     WHERE ticket_tags.ticket_id IN (?)`,
    [tickets.map((t) => t.id)],
  );

  return rows.reduce((acc, row) => {
    acc[row.ticket_id] = acc[row.ticket_id] || [];
    acc[row.ticket_id].push(row.name);
    return acc;
  }, {});
}

async function createTicket(orgId, data) {
  const { customerName, customerEmail, subject, description, category, priority } = data;

  if (!customerName || !customerEmail || !subject || !description) {
    throw new ApiError(400, 'customerName, customerEmail, subject, and description are required');
  }
  if (priority && !PRIORITIES.includes(priority)) {
    throw new ApiError(400, `priority must be one of: ${PRIORITIES.join(', ')}`);
  }

  const db = forOrg(orgId);
  const customerId = await findOrCreateCustomer(db, { customerName, customerEmail });

  const ticketId = await db.insert('tickets', {
    customer_id: customerId,
    subject,
    description,
    category: category || null,
    priority: priority || 'medium',
  });

  return getTicketById(orgId, ticketId);
}

async function listTickets(orgId, filters) {
  const db = forOrg(orgId);
  const conditions = ['t.org_id = :orgId'];
  const params = [];
  const joins = [];

  if (filters.status) {
    conditions.push('t.status = ?');
    params.push(filters.status);
  }
  if (filters.priority) {
    conditions.push('t.priority = ?');
    params.push(filters.priority);
  }
  if (filters.category) {
    conditions.push('t.category = ?');
    params.push(filters.category);
  }
  if (filters.assignedAgentId === 'unassigned') {
    conditions.push('t.assigned_agent_id IS NULL');
  } else if (filters.assignedAgentId) {
    conditions.push('t.assigned_agent_id = ?');
    params.push(filters.assignedAgentId);
  }
  if (filters.tag) {
    joins.push(
      'JOIN ticket_tags tt ON tt.ticket_id = t.id JOIN tags ON tags.id = tt.tag_id AND tags.org_id = :orgId',
    );
    conditions.push('tags.name = ?');
    params.push(filters.tag);
  }

  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const rows = await db.sql(
    `SELECT DISTINCT t.* FROM tickets t
     ${joins.join(' ')}
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const tagsByTicketId = await attachTagsToTickets(db, rows);
  return {
    tickets: rows.map((row) => ({ ...row, tags: tagsByTicketId[row.id] || [] })),
    page,
    limit,
  };
}

async function getTicketById(orgId, ticketId) {
  const db = forOrg(orgId);

  const rows = await db.sql(
    `SELECT t.*, u.name AS customer_name, u.email AS customer_email
     FROM tickets t
     LEFT JOIN users u ON u.id = t.customer_id AND u.org_id = :orgId
     WHERE t.id = ? AND t.org_id = :orgId`,
    [ticketId],
  );
  const ticket = rows[0];
  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  const comments = await db.sql(
    `SELECT tc.*,
       CASE WHEN tc.author_agent_id IS NOT NULL THEN 'agent' ELSE 'customer' END AS author_type,
       COALESCE(a.name, cu.name) AS author_name
     FROM ticket_comments tc
     LEFT JOIN agents a ON a.id = tc.author_agent_id AND a.org_id = :orgId
     LEFT JOIN users cu ON cu.id = tc.author_customer_id AND cu.org_id = :orgId
     WHERE tc.ticket_id = ? AND tc.org_id = :orgId
     ORDER BY tc.created_at ASC`,
    [ticketId],
  );
  const tags = await getTicketTags(db, ticketId);

  return { ...ticket, comments, tags };
}

async function updateTicket(orgId, ticketId, updates) {
  const db = forOrg(orgId);
  const fields = {};

  if (updates.status !== undefined) {
    if (!STATUSES.includes(updates.status)) {
      throw new ApiError(400, `status must be one of: ${STATUSES.join(', ')}`);
    }
    fields.status = updates.status;
  }
  if (updates.priority !== undefined) {
    if (!PRIORITIES.includes(updates.priority)) {
      throw new ApiError(400, `priority must be one of: ${PRIORITIES.join(', ')}`);
    }
    fields.priority = updates.priority;
  }
  if (updates.assignedAgentId !== undefined) {
    // The UPDATE is org-scoped, so a caller can only reach their own ticket - but
    // nothing checked the value being written, which let an agent assign their
    // ticket to an agent in another organization. The scoping guard cannot catch
    // this: the predicate is right, the value is not. Look the agent up through
    // the org scope so a foreign id is simply not found.
    if (updates.assignedAgentId === null) {
      fields.assigned_agent_id = null;
    } else {
      await db.get('agents', updates.assignedAgentId, 'Assigned agent not found', {
        columns: 'id',
      });
      fields.assigned_agent_id = updates.assignedAgentId;
    }
  }

  if (Object.keys(fields).length === 0 && updates.tagNames === undefined) {
    throw new ApiError(400, 'No valid fields to update');
  }

  if (Object.keys(fields).length > 0) {
    await db.update('tickets', ticketId, fields, 'Ticket not found');
  } else {
    await db.get('tickets', ticketId, 'Ticket not found', { columns: 'id' });
  }

  if (Array.isArray(updates.tagNames)) {
    await syncTicketTags(db, ticketId, updates.tagNames);
  }

  return getTicketById(orgId, ticketId);
}

module.exports = { createTicket, listTickets, getTicketById, updateTicket };

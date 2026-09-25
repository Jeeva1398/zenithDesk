const { forOrg } = require('../db/orgScope');
const ticketService = require('./ticket.service');
const commentService = require('./comment.service');
const ApiError = require('../utils/ApiError');

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['open', 'pending', 'resolved', 'closed'];

// A macro is a saved bundle of the edits an agent would otherwise make by hand on
// a ticket. Every field is optional, but an empty macro would be a no-op button,
// so at least one has to be set.
function validateActions(actions) {
  if (!actions || typeof actions !== 'object' || Array.isArray(actions)) {
    throw new ApiError(400, 'actions must be an object');
  }

  const { status, priority, assignedAgentId, comment } = actions;

  if (status !== undefined && status !== null && !STATUSES.includes(status)) {
    throw new ApiError(400, `actions.status must be one of: ${STATUSES.join(', ')}`);
  }
  if (priority !== undefined && priority !== null && !PRIORITIES.includes(priority)) {
    throw new ApiError(400, `actions.priority must be one of: ${PRIORITIES.join(', ')}`);
  }
  if (comment !== undefined && comment !== null && typeof comment !== 'string') {
    throw new ApiError(400, 'actions.comment must be a string');
  }
  if (typeof comment === 'string' && comment.trim() === '') {
    throw new ApiError(400, 'actions.comment cannot be blank - omit it instead');
  }

  const cleaned = {};
  if (status) cleaned.status = status;
  if (priority) cleaned.priority = priority;
  if (assignedAgentId !== undefined && assignedAgentId !== null) {
    cleaned.assignedAgentId = Number(assignedAgentId);
  }
  if (typeof comment === 'string') cleaned.comment = comment.trim();

  if (Object.keys(cleaned).length === 0) {
    throw new ApiError(400, 'A macro must set at least one of: status, priority, assignee, comment');
  }
  return cleaned;
}

function parseMacro(row) {
  return {
    ...row,
    actions: typeof row.actions === 'string' ? JSON.parse(row.actions) : row.actions,
  };
}

async function listMacros(orgId) {
  const rows = await forOrg(orgId).list('macros', {}, { orderBy: 'name ASC' });
  return { macros: rows.map(parseMacro) };
}

async function getMacro(orgId, macroId) {
  return parseMacro(await forOrg(orgId).get('macros', macroId, 'Macro not found'));
}

async function createMacro(orgId, agentId, { name, actions }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ApiError(400, 'name is required');
  }

  const db = forOrg(orgId);
  const cleaned = validateActions(actions);

  // The unique index on (org_id, name) is the real guarantee; this check exists
  // to turn its 1062 into a message an agent can act on.
  if (await db.exists('macros', { name: name.trim() })) {
    throw new ApiError(409, 'A macro with this name already exists');
  }

  const macroId = await db.insert('macros', {
    created_by_agent_id: agentId,
    name: name.trim(),
    actions: JSON.stringify(cleaned),
  });

  return getMacro(orgId, macroId);
}

async function updateMacro(orgId, macroId, { name, actions }) {
  const db = forOrg(orgId);
  const updates = {};

  if (name !== undefined) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new ApiError(400, 'name cannot be blank');
    }
    if (await db.exists('macros', { name: name.trim(), id: { not: macroId } })) {
      throw new ApiError(409, 'A macro with this name already exists');
    }
    updates.name = name.trim();
  }
  if (actions !== undefined) {
    updates.actions = JSON.stringify(validateActions(actions));
  }
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'No valid fields to update');
  }

  await db.update('macros', macroId, updates, 'Macro not found');
  return getMacro(orgId, macroId);
}

async function deleteMacro(orgId, macroId) {
  await forOrg(orgId).remove('macros', macroId, 'Macro not found');
}

// Applying a macro is exactly the edits an agent would have made by hand, so it
// goes through the same services rather than writing to tickets directly - the
// validation and the org scoping are then shared rather than duplicated.
async function applyMacro(orgId, agentId, ticketId, macroId) {
  const macro = await getMacro(orgId, macroId);
  const { status, priority, assignedAgentId, comment } = macro.actions;

  const updates = {};
  if (status) updates.status = status;
  if (priority) updates.priority = priority;
  if (assignedAgentId !== undefined) updates.assignedAgentId = assignedAgentId;

  if (Object.keys(updates).length > 0) {
    await ticketService.updateTicket(orgId, ticketId, updates);
  }
  if (comment) {
    // addComment re-checks that the ticket belongs to this org, which is what
    // makes a comment-only macro safe without a redundant lookup here.
    await commentService.addComment(orgId, ticketId, agentId, comment);
  }

  return ticketService.getTicketById(orgId, ticketId);
}

module.exports = {
  listMacros,
  applyMacro,
  getMacro,
  createMacro,
  updateMacro,
  deleteMacro,
  validateActions,
};

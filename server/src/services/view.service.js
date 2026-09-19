const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');

async function listViews(orgId) {
  const rows = await forOrg(orgId).list('views', {}, { orderBy: 'created_at ASC' });
  return { views: rows.map(parseView) };
}

async function createView(orgId, agentId, { name, filters }) {
  if (!name || !filters || typeof filters !== 'object') {
    throw new ApiError(400, 'name and filters are required');
  }

  const db = forOrg(orgId);
  const viewId = await db.insert('views', {
    created_by_agent_id: agentId,
    name,
    filters: JSON.stringify(filters),
  });

  return getView(db, viewId);
}

async function updateView(orgId, viewId, { name, filters }) {
  const updates = {};
  if (name !== undefined) {
    updates.name = name;
  }
  if (filters !== undefined) {
    updates.filters = JSON.stringify(filters);
  }
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'No valid fields to update');
  }

  const db = forOrg(orgId);
  await db.update('views', viewId, updates, 'View not found');
  return getView(db, viewId);
}

async function deleteView(orgId, viewId) {
  await forOrg(orgId).remove('views', viewId, 'View not found');
}

async function getView(db, viewId) {
  return parseView(await db.get('views', viewId, 'View not found'));
}

function parseView(row) {
  return {
    ...row,
    filters: typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters,
  };
}

module.exports = { listViews, createView, updateView, deleteView };

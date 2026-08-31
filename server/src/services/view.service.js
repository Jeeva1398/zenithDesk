const pool = require('../db/connection');
const ApiError = require('../utils/ApiError');

async function listViews(orgId) {
  const [rows] = await pool.query(
    'SELECT * FROM views WHERE org_id = ? ORDER BY created_at ASC',
    [orgId],
  );
  return { views: rows.map(parseView) };
}

async function createView(orgId, agentId, { name, filters }) {
  if (!name || !filters || typeof filters !== 'object') {
    throw new ApiError(400, 'name and filters are required');
  }

  const [result] = await pool.query(
    `INSERT INTO views (org_id, created_by_agent_id, name, filters, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [orgId, agentId, name, JSON.stringify(filters)],
  );

  return getView(orgId, result.insertId);
}

async function updateView(orgId, viewId, { name, filters }) {
  const setClauses = [];
  const params = [];

  if (name !== undefined) {
    setClauses.push('name = ?');
    params.push(name);
  }
  if (filters !== undefined) {
    setClauses.push('filters = ?');
    params.push(JSON.stringify(filters));
  }
  if (setClauses.length === 0) {
    throw new ApiError(400, 'No valid fields to update');
  }

  setClauses.push('updated_at = NOW()');
  const [result] = await pool.query(
    `UPDATE views SET ${setClauses.join(', ')} WHERE id = ? AND org_id = ?`,
    [...params, viewId, orgId],
  );
  if (result.affectedRows === 0) {
    throw new ApiError(404, 'View not found');
  }

  return getView(orgId, viewId);
}

async function deleteView(orgId, viewId) {
  const [result] = await pool.query('DELETE FROM views WHERE id = ? AND org_id = ?', [
    viewId,
    orgId,
  ]);
  if (result.affectedRows === 0) {
    throw new ApiError(404, 'View not found');
  }
}

async function getView(orgId, viewId) {
  const [rows] = await pool.query('SELECT * FROM views WHERE id = ? AND org_id = ?', [
    viewId,
    orgId,
  ]);
  if (!rows[0]) {
    throw new ApiError(404, 'View not found');
  }
  return parseView(rows[0]);
}

function parseView(row) {
  return {
    ...row,
    filters: typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters,
  };
}

module.exports = { listViews, createView, updateView, deleteView };

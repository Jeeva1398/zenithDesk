const pool = require('../db/connection');

async function listTags(orgId) {
  const [rows] = await pool.query('SELECT id, name FROM tags WHERE org_id = ? ORDER BY name ASC', [
    orgId,
  ]);
  return { tags: rows };
}

module.exports = { listTags };

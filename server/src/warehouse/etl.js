require('dotenv').config();

const oltpPool = require('../db/connection');
const warehousePool = require('./db');
const logger = require('../config/logger');

const JOB_NAME = 'ticket_daily_rollup';
const EPOCH = new Date(0);

async function getWatermark() {
  const [rows] = await warehousePool.query('SELECT last_run_at FROM etl_runs WHERE job_name = ?', [JOB_NAME]);
  return rows[0]?.last_run_at || EPOCH;
}

async function setWatermark(timestamp) {
  await warehousePool.query(
    `INSERT INTO etl_runs (job_name, last_run_at, created_at, updated_at)
     VALUES (?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE last_run_at = VALUES(last_run_at), updated_at = NOW()`,
    [JOB_NAME, timestamp],
  );
}

async function loadMap(table, keyCol, valCol) {
  const [rows] = await warehousePool.query(`SELECT ${keyCol}, ${valCol} FROM ${table}`);
  return new Map(rows.map((row) => [row[keyCol], row[valCol]]));
}

// dim_category's unique constraint is case-insensitive (MySQL's default collation),
// but a JS Map lookup isn't — normalize both sides so 'billing' and 'Billing' resolve
// to the same dimension row.
async function loadCategoryMap() {
  const [rows] = await warehousePool.query('SELECT category, id FROM dim_category');
  return new Map(rows.map((row) => [row.category.toLowerCase(), row.id]));
}

// SCD Type 1 — dimensions are small and always overwritten with the latest source values.
async function refreshDimensions() {
  const [orgs] = await oltpPool.query('SELECT id, name FROM organizations');
  for (const org of orgs) {
    await warehousePool.query(
      `INSERT INTO dim_organization (org_id, name, created_at, updated_at)
       VALUES (?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = NOW()`,
      [org.id, org.name],
    );
  }

  const [agents] = await oltpPool.query('SELECT id, org_id, name, email, role FROM agents');
  for (const agent of agents) {
    await warehousePool.query(
      `INSERT INTO dim_agent (agent_id, org_id, name, email, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE org_id = VALUES(org_id), name = VALUES(name), email = VALUES(email), role = VALUES(role), updated_at = NOW()`,
      [agent.id, agent.org_id, agent.name, agent.email, agent.role],
    );
  }

  const [categories] = await oltpPool.query(
    "SELECT DISTINCT COALESCE(NULLIF(TRIM(category), ''), 'Uncategorized') AS category FROM tickets",
  );
  const categoryNames = new Set(categories.map((row) => row.category));
  categoryNames.add('Uncategorized');
  for (const category of categoryNames) {
    await warehousePool.query(
      `INSERT INTO dim_category (category, created_at, updated_at)
       VALUES (?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [category],
    );
  }
}

// A ticket's daily bucket is keyed by its creation date, so any ticket whose
// status/updated_at changed, or that received a new comment, since the
// watermark makes that (org, day) partition stale and due for a full rebuild.
async function findAffectedPartitions(watermark) {
  const [rows] = await oltpPool.query(
    `SELECT DISTINCT org_id, DATE_FORMAT(created_at, '%Y-%m-%d') AS date_key
       FROM tickets
       WHERE updated_at > ?
     UNION
     SELECT DISTINCT t.org_id, DATE_FORMAT(t.created_at, '%Y-%m-%d') AS date_key
       FROM tickets t
       JOIN ticket_comments c ON c.ticket_id = t.id
       WHERE c.updated_at > ?`,
    [watermark, watermark],
  );
  return rows.map((row) => ({ orgId: row.org_id, dateKey: row.date_key }));
}

// Recomputes one (org, day) partition from scratch rather than incrementing
// existing rows — keeps averages correct without tracking running sums.
async function fetchPartitionRollup(orgId, dateKey) {
  const [rows] = await oltpPool.query(
    `SELECT
       t.assigned_agent_id AS agent_id,
       COALESCE(NULLIF(TRIM(t.category), ''), 'Uncategorized') AS category,
       t.priority AS priority,
       COUNT(*) AS tickets_created,
       SUM(CASE WHEN t.status IN ('resolved', 'closed') THEN 1 ELSE 0 END) AS tickets_resolved,
       AVG(CASE WHEN t.status IN ('resolved', 'closed')
                THEN TIMESTAMPDIFF(MINUTE, t.created_at, t.updated_at) END) / 60.0 AS avg_resolution_hours,
       AVG(TIMESTAMPDIFF(MINUTE, t.created_at, fc.first_agent_reply_at)) / 60.0 AS avg_first_response_hours
     FROM tickets t
     LEFT JOIN (
       SELECT ticket_id, MIN(created_at) AS first_agent_reply_at
       FROM ticket_comments
       WHERE author_agent_id IS NOT NULL
       GROUP BY ticket_id
     ) fc ON fc.ticket_id = t.id
     WHERE t.org_id = ? AND DATE_FORMAT(t.created_at, '%Y-%m-%d') = ?
     GROUP BY t.assigned_agent_id, category, t.priority`,
    [orgId, dateKey],
  );
  return rows;
}

async function rebuildPartition({ orgId, dateKey, dimOrgMap, dimAgentMap, dimCategoryMap }) {
  const dimOrgId = dimOrgMap.get(orgId);
  if (!dimOrgId) {
    logger.warn(`Skipping partition for unknown org_id=${orgId} (not found in dim_organization)`);
    return;
  }

  await warehousePool.query('DELETE FROM fact_ticket_daily WHERE date_key = ? AND dim_organization_id = ?', [
    dateKey,
    dimOrgId,
  ]);

  const buckets = await fetchPartitionRollup(orgId, dateKey);
  for (const bucket of buckets) {
    const dimAgentId = bucket.agent_id ? dimAgentMap.get(bucket.agent_id) || null : null;
    const dimCategoryId = dimCategoryMap.get(bucket.category.toLowerCase());

    await warehousePool.query(
      `INSERT INTO fact_ticket_daily
         (date_key, dim_organization_id, dim_agent_id, dim_category_id, priority,
          tickets_created, tickets_resolved, avg_first_response_hours, avg_resolution_hours,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        dateKey,
        dimOrgId,
        dimAgentId,
        dimCategoryId,
        bucket.priority,
        bucket.tickets_created,
        bucket.tickets_resolved,
        bucket.avg_first_response_hours,
        bucket.avg_resolution_hours,
      ],
    );
  }
}

async function run() {
  const startedAt = new Date();
  const watermark = await getWatermark();
  logger.info(`ETL run starting (watermark: ${watermark.toISOString()})`);

  await refreshDimensions();

  const dimOrgMap = await loadMap('dim_organization', 'org_id', 'id');
  const dimAgentMap = await loadMap('dim_agent', 'agent_id', 'id');
  const dimCategoryMap = await loadCategoryMap();

  const partitions = await findAffectedPartitions(watermark);
  logger.info(`${partitions.length} (org, day) partition(s) to rebuild`);

  for (const partition of partitions) {
    await rebuildPartition({ ...partition, dimOrgMap, dimAgentMap, dimCategoryMap });
  }

  await setWatermark(startedAt);
  logger.info('ETL run complete');
}

run()
  .catch((err) => {
    logger.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await oltpPool.end();
    await warehousePool.end();
  });

const warehousePool = require('../warehouse/db');

async function getDimOrgId(orgId) {
  const [rows] = await warehousePool.query('SELECT id FROM dim_organization WHERE org_id = ?', [orgId]);
  return rows[0]?.id || null;
}

function emptyOverview(days) {
  return {
    range: { days },
    totals: {
      ticketsCreated: 0,
      ticketsResolved: 0,
      avgFirstResponseHours: null,
      avgResolutionHours: null,
    },
    trend: [],
    byCategory: [],
    byAgent: [],
    byPriority: [],
  };
}

function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

// The query only returns days with activity — backfill the gaps so the trend
// is a continuous daily series (a line chart connecting sparse dates would
// visually lie about which days had zero tickets vs. no data at all).
function fillDailySeries(rows, days) {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const series = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCDate(cursor.getUTCDate() - (days - 1));

  for (let i = 0; i < days; i += 1) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const existing = byDate.get(dateKey);
    series.push({
      date: dateKey,
      ticketsCreated: existing ? Number(existing.ticketsCreated) : 0,
      ticketsResolved: existing ? Number(existing.ticketsResolved) : 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return series;
}

async function getOverview(orgId, days) {
  const dimOrgId = await getDimOrgId(orgId);
  if (!dimOrgId) {
    return emptyOverview(days);
  }

  const [totalsRows] = await warehousePool.query(
    `SELECT
       COALESCE(SUM(tickets_created), 0) AS tickets_created,
       COALESCE(SUM(tickets_resolved), 0) AS tickets_resolved,
       AVG(avg_first_response_hours) AS avg_first_response_hours,
       AVG(avg_resolution_hours) AS avg_resolution_hours
     FROM fact_ticket_daily
     WHERE dim_organization_id = ? AND date_key >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
    [dimOrgId, days],
  );
  const totalsRow = totalsRows[0];

  const [trend] = await warehousePool.query(
    `SELECT
       DATE_FORMAT(date_key, '%Y-%m-%d') AS date,
       SUM(tickets_created) AS ticketsCreated,
       SUM(tickets_resolved) AS ticketsResolved
     FROM fact_ticket_daily
     WHERE dim_organization_id = ? AND date_key >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY date_key
     ORDER BY date_key ASC`,
    [dimOrgId, days],
  );

  const [byCategory] = await warehousePool.query(
    `SELECT c.category AS category, SUM(f.tickets_created) AS ticketsCreated
     FROM fact_ticket_daily f
     JOIN dim_category c ON c.id = f.dim_category_id
     WHERE f.dim_organization_id = ? AND f.date_key >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY c.category
     ORDER BY ticketsCreated DESC`,
    [dimOrgId, days],
  );

  const [byAgent] = await warehousePool.query(
    `SELECT
       COALESCE(a.name, 'Unassigned') AS agent,
       SUM(f.tickets_created) AS ticketsCreated,
       SUM(f.tickets_resolved) AS ticketsResolved
     FROM fact_ticket_daily f
     LEFT JOIN dim_agent a ON a.id = f.dim_agent_id
     WHERE f.dim_organization_id = ? AND f.date_key >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY agent
     ORDER BY ticketsCreated DESC`,
    [dimOrgId, days],
  );

  const [byPriority] = await warehousePool.query(
    `SELECT priority, SUM(tickets_created) AS ticketsCreated
     FROM fact_ticket_daily
     WHERE dim_organization_id = ? AND date_key >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY priority`,
    [dimOrgId, days],
  );

  return {
    range: { days },
    totals: {
      ticketsCreated: Number(totalsRow.tickets_created),
      ticketsResolved: Number(totalsRow.tickets_resolved),
      avgFirstResponseHours: toNumber(totalsRow.avg_first_response_hours),
      avgResolutionHours: toNumber(totalsRow.avg_resolution_hours),
    },
    trend: fillDailySeries(trend, days),
    byCategory: byCategory.map((row) => ({
      category: row.category,
      ticketsCreated: Number(row.ticketsCreated),
    })),
    byAgent: byAgent.map((row) => ({
      agent: row.agent,
      ticketsCreated: Number(row.ticketsCreated),
      ticketsResolved: Number(row.ticketsResolved),
    })),
    byPriority: byPriority.map((row) => ({
      priority: row.priority,
      ticketsCreated: Number(row.ticketsCreated),
    })),
  };
}

module.exports = { getOverview };

const pool = require('./connection');
const ApiError = require('../utils/ApiError');
const { ORG_SCOPED_TABLES } = require('./tenancy');

// Table and column names reach the SQL string by interpolation, so they are
// checked against the identifier shape even though every one of them is a
// literal in our own code today.
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;

function quote(name) {
  if (!IDENTIFIER.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
  return `\`${name}\``;
}

function scopedTable(table) {
  if (!ORG_SCOPED_TABLES.has(table)) {
    throw new Error(
      `${table} is not an org-scoped table - query it through the pool directly, ` +
        'marking the statement /* unscoped: <reason> */.',
    );
  }
  return quote(table);
}

// `where` is either an id, or a map of column to value. A null value becomes
// IS NULL, and { not: value } becomes <>, which covers every comparison the
// services actually make.
function buildWhere(orgId, where) {
  const criteria = typeof where === 'object' && where !== null ? where : { id: where };
  const clauses = ['`org_id` = ?'];
  const params = [orgId];

  for (const [column, value] of Object.entries(criteria)) {
    if (value === null) {
      clauses.push(`${quote(column)} IS NULL`);
    } else if (typeof value === 'object' && 'not' in value) {
      clauses.push(`${quote(column)} <> ?`);
      params.push(value.not);
    } else {
      clauses.push(`${quote(column)} = ?`);
      params.push(value);
    }
  }

  return { clause: clauses.join(' AND '), params };
}

function tail({ orderBy, limit, offset }) {
  let sql = '';
  const params = [];
  if (orderBy) sql += ` ORDER BY ${orderBy}`;
  if (limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(limit);
    if (offset !== undefined) {
      sql += ' OFFSET ?';
      params.push(offset);
    }
  }
  return { sql, params };
}

// Binds every query in a request to one organization. The org_id predicate is
// added by the helper rather than written out at each call site, which is the
// whole point: a caller cannot forget it, because it never had the option of
// supplying it.
function forOrg(orgId) {
  if (orgId === undefined || orgId === null) {
    throw new Error('forOrg requires an orgId');
  }

  async function list(table, where = {}, options = {}) {
    const { clause, params } = buildWhere(orgId, where);
    const end = tail(options);
    const [rows] = await pool.query(
      `SELECT ${options.columns || '*'} FROM ${scopedTable(table)} WHERE ${clause}${end.sql}`,
      [...params, ...end.params],
    );
    return rows;
  }

  async function find(table, where, options = {}) {
    const rows = await list(table, where, { ...options, limit: 1 });
    return rows[0] || null;
  }

  async function get(table, where, notFound, options = {}) {
    const row = await find(table, where, options);
    if (!row) {
      throw new ApiError(404, notFound);
    }
    return row;
  }

  async function insert(table, data) {
    const columns = Object.keys(data);
    const [result] = await pool.query(
      `INSERT INTO ${scopedTable(table)} (\`org_id\`, ${columns.map(quote).join(', ')}, \`created_at\`, \`updated_at\`)
       VALUES (?, ${columns.map(() => '?').join(', ')}, NOW(), NOW())`,
      [orgId, ...Object.values(data)],
    );
    return result.insertId;
  }

  // Returns the number of rows matched. Passing `notFound` turns "matched
  // nothing" into a 404, which is what every caller that targets a single row
  // wants - an id that isn't in this org is indistinguishable from one that
  // doesn't exist, and should stay that way.
  async function update(table, where, data, notFound) {
    const assignments = Object.keys(data).map((column) => `${quote(column)} = ?`);
    const { clause, params } = buildWhere(orgId, where);

    const [result] = await pool.query(
      `UPDATE ${scopedTable(table)} SET ${assignments.join(', ')}, \`updated_at\` = NOW() WHERE ${clause}`,
      [...Object.values(data), ...params],
    );

    if (result.affectedRows === 0 && notFound) {
      throw new ApiError(404, notFound);
    }
    return result.affectedRows;
  }

  async function remove(table, where, notFound) {
    const { clause, params } = buildWhere(orgId, where);
    const [result] = await pool.query(
      `DELETE FROM ${scopedTable(table)} WHERE ${clause}`,
      params,
    );
    if (result.affectedRows === 0 && notFound) {
      throw new ApiError(404, notFound);
    }
    return result.affectedRows;
  }

  async function count(table, where = {}) {
    const { clause, params } = buildWhere(orgId, where);
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count FROM ${scopedTable(table)} WHERE ${clause}`,
      params,
    );
    return Number(rows[0].count);
  }

  async function exists(table, where) {
    return (await find(table, where, { columns: '1' })) !== null;
  }

  // Escape hatch for joins and aggregates the helpers above can't express.
  // The org id is bound to the :orgId placeholder so it still cannot be
  // omitted or mistyped, and the guard in db/connection rejects the statement
  // if it reaches an org-scoped table without naming org_id at all.
  async function sql(text, params = []) {
    const bound = [];
    let next = 0;

    const prepared = text.replace(/:orgId\b|\?/g, (token) => {
      bound.push(token === ':orgId' ? orgId : params[next++]);
      return '?';
    });

    if (next !== params.length) {
      throw new Error(`sql() got ${params.length} params but the statement binds ${next}`);
    }

    const [rows] = await pool.query(prepared, bound);
    return rows;
  }

  return { orgId, list, find, get, insert, update, remove, count, exists, sql };
}

module.exports = { forOrg };

const mysql = require('mysql2/promise');
const logger = require('../config/logger');
const { assertTenantScoped } = require('./tenancy');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// mysql2/promise's pool is a thin wrapper (PromisePool) around the
// underlying callback-based Pool - internal connection errors (e.g. MySQL
// closing an idle connection) are emitted on `pool.pool`, NOT on the
// wrapper itself, so the listener must be attached there. Without it, an
// unhandled 'error' event crashes the whole Node process with no output.
pool.pool.on('error', (err) => {
  logger.error(`MySQL pool error (connection dropped, pool will recover): ${err.message}`);
});

// Every statement goes through the tenancy guard, including the ones written
// by hand rather than through forOrg(). A missed org_id is a cross-tenant
// leak, so this fails closed in every environment rather than logging and
// carrying on - a 500 is recoverable, data crossing tenants is not.
function guard(target, method) {
  const original = target[method].bind(target);
  target[method] = (sql, values) => {
    assertTenantScoped(sql);
    return original(sql, values);
  };
}

guard(pool, 'query');
guard(pool, 'execute');

// A connection checked out for a transaction or a batch bypasses pool.query
// entirely, so it is wrapped on the way out.
const getConnection = pool.getConnection.bind(pool);
pool.getConnection = async () => {
  const connection = await getConnection();
  guard(connection, 'query');
  guard(connection, 'execute');
  return connection;
};

module.exports = pool;

const mysql = require('mysql2/promise');
const logger = require('../config/logger');

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
// underlying callback-based Pool — internal connection errors (e.g. MySQL
// closing an idle connection) are emitted on `pool.pool`, NOT on the
// wrapper itself, so the listener must be attached there. Without it, an
// unhandled 'error' event crashes the whole Node process with no output.
pool.pool.on('error', (err) => {
  logger.error(`MySQL pool error (connection dropped, pool will recover): ${err.message}`);
});

module.exports = pool;

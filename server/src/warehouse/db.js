const mysql = require('mysql2/promise');
const logger = require('../config/logger');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.WAREHOUSE_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

pool.pool.on('error', (err) => {
  logger.error(`Warehouse MySQL pool error (connection dropped, pool will recover): ${err.message}`);
});

module.exports = pool;

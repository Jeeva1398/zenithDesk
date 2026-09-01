require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

module.exports = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.WAREHOUSE_DB_NAME,
  },
  migrations: {
    directory: './migrations',
  },
};

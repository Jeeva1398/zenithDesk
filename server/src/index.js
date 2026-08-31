require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./db/connection');
const logger = require('./config/logger');
const morgan = require('./middlewares/morgan');
const routes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan.successHandler);
app.use(morgan.errorHandler);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(routes);

app.use(notFound);
app.use(errorHandler);

// Without these, an unhandled error/rejection crashes the process with no
// logged cause (nodemon just reports "app crashed"). Log first, then exit —
// process state after an uncaught error can't be trusted, but at least the
// real cause is now visible.
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — process will exit:');
  logger.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection — process will exit:');
  logger.error(reason instanceof Error ? reason : new Error(String(reason)));
  process.exit(1);
});

const server = app.listen(port, async () => {
  logger.info(`Server listening on port ${port}`);

  try {
    await pool.query('SELECT 1');
    logger.info('Database connection OK');
  } catch (err) {
    logger.warn(`Database connection failed (continuing without it): ${err.message}`);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${port} is already in use — is another instance of the server running?`);
  } else {
    logger.error(err);
  }
  process.exit(1);
});

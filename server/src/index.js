require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pool = require('./db/connection');
const logger = require('./config/logger');
const { startEtlSchedule } = require('./warehouse/scheduler');
const { validateEnv, getCorsOrigins } = require('./config/env');
const morgan = require('./middlewares/morgan');
const routes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const ApiError = require('./utils/ApiError');
const { generalLimiter } = require('./middlewares/rateLimiters');

validateEnv();

const app = express();
const port = process.env.PORT || 3000;

// Rate limiting keys on req.ip, which behind a proxy is the proxy's address
// unless Express is told how many hops to trust — every caller would then
// share one bucket. Trusting blindly is worse though: a spoofed
// X-Forwarded-For would hand each request its own bucket and void the limits.
// So the hop count is explicit config, defaulting to "no proxy".
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));

app.use(helmet());

const corsOrigins = getCorsOrigins();
app.use(
  cors({
    // A missing Origin header is a non-browser caller (curl, the chatbot's
    // server-side ticket client, health checks) — those aren't what CORS
    // protects against, so they pass through.
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new ApiError(403, 'Origin not allowed'));
    },
  }),
);

// Nothing this API accepts is anywhere near 100kb; the default 100kb limit is
// stated explicitly so it's a decision rather than a default nobody looked at.
app.use(express.json({ limit: '100kb' }));
app.use(morgan.successHandler);
app.use(morgan.errorHandler);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(generalLimiter);
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

  // No-op unless ETL_SCHEDULE is set, so only an environment that opts in runs
  // the warehouse rebuild in-process.
  startEtlSchedule();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${port} is already in use — is another instance of the server running?`);
  } else {
    logger.error(err);
  }
  process.exit(1);
});

const logger = require('../config/logger');

// body-parser rejects oversized and malformed payloads before any route runs,
// with errors that carry the right status but aren't ApiErrors - so they'd
// otherwise surface as "Internal server error" on a 400 or 413, telling the
// caller nothing about what they actually sent wrong.
const BODY_PARSER_MESSAGES = {
  'entity.too.large': 'Request body is too large',
  'entity.parse.failed': 'Request body is not valid JSON',
};

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const bodyParserMessage = BODY_PARSER_MESSAGES[err.type];
  const message = bodyParserMessage || (err.isOperational ? err.message : 'Internal server error');

  res.locals.errorMessage = err.message;

  // Previously this only logged in development, which meant production 500s -
  // the ones nobody can reproduce locally - left no trace at all. Log
  // everywhere, but keep expected 4xx noise (bad input, wrong password, rate
  // limits) at `warn` so real faults still stand out in the logs.
  if (statusCode >= 500) {
    logger.error(err);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} → ${statusCode}: ${err.message}`);
  }

  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;

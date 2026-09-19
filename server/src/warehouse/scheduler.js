const cron = require('node-cron');
const logger = require('../config/logger');

// Required lazily, on the first run rather than on import. Loading etl.js opens
// both the OLTP and warehouse pools as a side effect, and a module that only
// decides *when* to run something has no business connecting to a database just
// by being imported - it also makes this file impossible to test in isolation.
function defaultEtlRun() {
  return require('./etl').run();
}

// Off unless ETL_SCHEDULE holds a cron expression, so `npm run dev`, the test
// suite and the bug-hunt instance never start rebuilding the warehouse behind
// the developer's back. Production opts in explicitly.
function scheduleConfig(env = process.env) {
  const expression = (env.ETL_SCHEDULE || '').trim();
  if (!expression) {
    return { enabled: false, reason: 'ETL_SCHEDULE is not set' };
  }
  if (!cron.validate(expression)) {
    return { enabled: false, reason: `ETL_SCHEDULE is not a valid cron expression: ${expression}` };
  }
  return { enabled: true, expression, timezone: (env.ETL_SCHEDULE_TZ || '').trim() || undefined };
}

// A run that outlives its interval would otherwise be started again on top of
// itself, and two runs rebuilding the same partition race over the watermark:
// whichever finishes last wins, and the changes the other picked up are skipped
// until something touches those rows again. One at a time, always.
function createRunner(etlRun = defaultEtlRun, log = logger) {
  let running = false;

  return async function runOnce(trigger = 'schedule') {
    if (running) {
      log.warn(`ETL (${trigger}) skipped: the previous run has not finished yet`);
      return { skipped: true };
    }

    running = true;
    const startedAt = Date.now();
    try {
      await etlRun();
      log.info(`ETL (${trigger}) finished in ${Date.now() - startedAt}ms`);
      return { skipped: false, ok: true };
    } catch (err) {
      // A failed run must not take the API process down with it, and must not
      // stop the next one from being attempted.
      log.error(`ETL (${trigger}) failed after ${Date.now() - startedAt}ms: ${err.message}`);
      return { skipped: false, ok: false, error: err };
    } finally {
      running = false;
    }
  };
}

function startEtlSchedule(env = process.env) {
  const config = scheduleConfig(env);

  if (!config.enabled) {
    logger.info(`ETL schedule disabled (${config.reason})`);
    return null;
  }

  const runOnce = createRunner();
  const task = cron.schedule(config.expression, () => runOnce('schedule'), {
    timezone: config.timezone,
  });

  logger.info(
    `ETL scheduled: ${config.expression}${config.timezone ? ` (${config.timezone})` : ''}`,
  );
  return { task, runOnce, expression: config.expression };
}

module.exports = { startEtlSchedule, scheduleConfig, createRunner };

const { test, expect } = require('@playwright/test');
const path = require('path');

const { scheduleConfig, createRunner } = require(
  path.resolve(__dirname, '..', '..', 'server', 'src', 'warehouse', 'scheduler'),
);

// Pure logic, driven directly: the scheduler's job is to decide whether to run
// and to refuse to run twice at once, neither of which needs a warehouse.
function silentLog() {
  const lines = { info: [], warn: [], error: [] };
  return {
    info: (m) => lines.info.push(m),
    warn: (m) => lines.warn.push(m),
    error: (m) => lines.error.push(m),
    lines,
  };
}

test.describe('ETL schedule configuration', () => {
  test('is off unless ETL_SCHEDULE is set', () => {
    expect(scheduleConfig({}).enabled).toBe(false);
    expect(scheduleConfig({ ETL_SCHEDULE: '' }).enabled).toBe(false);
    expect(scheduleConfig({ ETL_SCHEDULE: '   ' }).enabled).toBe(false);
  });

  test('accepts a valid cron expression', () => {
    const config = scheduleConfig({ ETL_SCHEDULE: '*/15 * * * *' });
    expect(config.enabled).toBe(true);
    expect(config.expression).toBe('*/15 * * * *');
  });

  test('refuses an invalid one rather than scheduling something surprising', () => {
    const config = scheduleConfig({ ETL_SCHEDULE: 'every 5 minutes please' });
    expect(config.enabled).toBe(false);
    expect(config.reason).toContain('not a valid cron expression');
  });

  test('passes a timezone through when given, and omits it when not', () => {
    expect(scheduleConfig({ ETL_SCHEDULE: '0 * * * *', ETL_SCHEDULE_TZ: 'Asia/Kolkata' }).timezone).toBe(
      'Asia/Kolkata',
    );
    expect(scheduleConfig({ ETL_SCHEDULE: '0 * * * *' }).timezone).toBeUndefined();
    expect(scheduleConfig({ ETL_SCHEDULE: '0 * * * *', ETL_SCHEDULE_TZ: '  ' }).timezone).toBeUndefined();
  });
});

test.describe('ETL run guard', () => {
  test('a second run is skipped while the first is still going', async () => {
    let release;
    const started = [];
    const blocked = new Promise((resolve) => {
      release = resolve;
    });

    const log = silentLog();
    const runOnce = createRunner(async () => {
      started.push(Date.now());
      await blocked;
    }, log);

    const first = runOnce('schedule');
    const second = await runOnce('schedule');

    expect(second.skipped).toBe(true);
    expect(started).toHaveLength(1);
    expect(log.lines.warn.join(' ')).toContain('has not finished yet');

    release();
    await first;
  });

  test('the next run is allowed once the previous one finishes', async () => {
    const log = silentLog();
    let calls = 0;
    const runOnce = createRunner(async () => {
      calls += 1;
    }, log);

    expect((await runOnce()).skipped).toBe(false);
    expect((await runOnce()).skipped).toBe(false);
    expect(calls).toBe(2);
  });

  test('a failing run is reported, not thrown, and does not wedge the guard', async () => {
    const log = silentLog();
    let calls = 0;
    const runOnce = createRunner(async () => {
      calls += 1;
      if (calls === 1) throw new Error('warehouse unreachable');
    }, log);

    const failed = await runOnce();
    expect(failed.ok).toBe(false);
    expect(log.lines.error.join(' ')).toContain('warehouse unreachable');

    // The whole point: one bad run must not stop every later one.
    const recovered = await runOnce();
    expect(recovered.ok).toBe(true);
    expect(calls).toBe(2);
  });
});

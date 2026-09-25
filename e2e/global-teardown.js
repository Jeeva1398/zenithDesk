const fs = require('fs');
const { PID_FILE } = require('./test-env');

// The API is spawned in globalSetup, so nothing else will clean it up. Leaving
// it running would hold the test port and silently serve the next run stale
// code.
module.exports = async () => {
  if (!fs.existsSync(PID_FILE)) return;

  const pid = Number(fs.readFileSync(PID_FILE, 'utf8').trim());
  fs.rmSync(PID_FILE, { force: true });

  if (!pid) return;

  try {
    process.kill(pid);
  } catch (err) {
    // Already gone (crashed, or killed by hand mid-run) - nothing to do.
    if (err.code !== 'ESRCH') throw err;
  }
};

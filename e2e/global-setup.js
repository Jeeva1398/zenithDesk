const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.resolve(__dirname, '..', 'server', '.env'), quiet: true });

const { TEST_DB_NAME, API_URL, SERVER_DIR, SERVER_LOG, PID_FILE, serverEnv } = require('./test-env');

// Drops and recreates the test schema on every run. Tests are written to be
// independent, but starting from a known-empty database is the only way a
// failure means "the code is wrong" rather than "something survived from the
// last run".
async function resetDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  await connection.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\``);
  await connection.query(`CREATE DATABASE \`${TEST_DB_NAME}\``);
  await connection.end();
}

function runMigrations() {
  execFileSync('npx', ['knex', 'migrate:latest'], {
    cwd: SERVER_DIR,
    env: serverEnv(),
    stdio: 'pipe',
    shell: true,
  });
}

// The API is started here rather than through Playwright's `webServer`
// because that launches before globalSetup, i.e. before the database it needs
// exists. Starting it by hand also lets its output go somewhere the tests can
// read: the server logs to the console only, and the line it prints instead of
// sending an OTP email is how the customer-portal tests obtain a code.
function startServer() {
  fs.mkdirSync(path.dirname(SERVER_LOG), { recursive: true });
  const logFd = fs.openSync(SERVER_LOG, 'w');

  const child = spawn('node', ['src/index.js'], {
    cwd: SERVER_DIR,
    env: serverEnv(),
    stdio: ['ignore', logFd, logFd],
    detached: false,
  });

  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid));
  return child;
}

async function waitForHealth({ timeoutMs = 30_000 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${API_URL}/health`);
      if (res.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const log = fs.existsSync(SERVER_LOG) ? fs.readFileSync(SERVER_LOG, 'utf8') : '(no output)';
  throw new Error(`API did not become healthy within ${timeoutMs}ms. Server output:\n${log}`);
}

module.exports = async () => {
  if (!process.env.DB_USER) {
    throw new Error(
      'server/.env is missing database settings — the e2e suite reads them to create its own schema',
    );
  }

  await resetDatabase();
  runMigrations();
  startServer();
  await waitForHealth();
};

const path = require('path');

// The suite runs against its own database and its own ports so a test run can
// never touch the dev data the developer is looking at, and so it doesn't
// collide with the dev server that's usually already running on :3000/:5173.
const TEST_DB_NAME = process.env.E2E_DB_NAME || 'zenithdesk_e2e';
const API_PORT = Number(process.env.E2E_API_PORT || 7100);
const CLIENT_PORT = Number(process.env.E2E_CLIENT_PORT || 5200);

const API_URL = `http://localhost:${API_PORT}`;
const CLIENT_URL = `http://localhost:${CLIENT_PORT}`;

const SERVER_DIR = path.resolve(__dirname, '..', 'server');
const CLIENT_DIR = path.resolve(__dirname, '..', 'client');
const SERVER_LOG = path.resolve(__dirname, '.tmp', 'server.log');
const PID_FILE = path.resolve(__dirname, '.tmp', 'server.pid');

// Long enough to satisfy the server's own 32-character minimum. Test-only, and
// deliberately not read from .env so a run can't accidentally mint tokens that
// are valid against a real environment.
const JWT_SECRET = 'e2e-test-secret-value-not-used-anywhere-else-0123456789';

// The API rate-limits OTP requests per IP, so without this every test in the
// suite would share one five-request bucket. Trusting 127.0.0.1 lets each test
// declare its own synthetic end-user IP via X-ZenithDesk-Client-IP and get its
// own bucket — the same mechanism the chatbot uses in production.
const TRUSTED_SERVICE_IPS = '127.0.0.1,::1';

function serverEnv(dbName = TEST_DB_NAME) {
  return {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(API_PORT),
    DB_NAME: dbName,
    JWT_SECRET,
    // Empty on purpose: email.service falls back to logging the OTP, which is
    // how the customer-portal tests get a code without a mail provider.
    RESEND_API_KEY: '',
    RESEND_FROM_EMAIL: '',
    CORS_ORIGINS: CLIENT_URL,
    TRUSTED_SERVICE_IPS,
    TRUST_PROXY_HOPS: '0',
  };
}

module.exports = {
  TEST_DB_NAME,
  API_PORT,
  CLIENT_PORT,
  API_URL,
  CLIENT_URL,
  SERVER_DIR,
  CLIENT_DIR,
  SERVER_LOG,
  PID_FILE,
  JWT_SECRET,
  TRUSTED_SERVICE_IPS,
  serverEnv,
};

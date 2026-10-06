// Runs against the deployed beta servers rather than a local copy:
//
//   npx playwright test -c playwright.beta.config.js
//
// If the beta portal is ever put behind basic auth again, give the run its
// login in the environment or in e2e/.env.beta (gitignored):
// BETA_BASIC_AUTH_USER / BETA_BASIC_AUTH_PASSWORD. Without them it goes
// straight in.
//
// Every run signs up a few fresh orgs on beta - test data only. The beta API
// limits signups per IP (20 an hour), so a handful of runs an hour is the most.
process.env.E2E_TARGET = 'beta';
require('dotenv').config({ path: require('path').resolve(__dirname, '.env.beta'), quiet: true });

const { defineConfig, devices } = require('@playwright/test');
const { BETA } = require('./test-env');

const httpCredentials = process.env.BETA_BASIC_AUTH_PASSWORD
  ? { username: process.env.BETA_BASIC_AUTH_USER || 'beta', password: process.env.BETA_BASIC_AUTH_PASSWORD }
  : undefined;

module.exports = defineConfig({
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  // A real model answers on beta, a few seconds a turn.
  timeout: 180_000,
  expect: { timeout: 15_000 },

  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'portal',
      testMatch: /products\.ui\.spec\.js/,
      use: { ...devices['Desktop Chrome'], baseURL: BETA.portal, httpCredentials },
    },
    {
      name: 'chat',
      testMatch: /.*\.beta\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

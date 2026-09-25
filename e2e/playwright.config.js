const { defineConfig, devices } = require('@playwright/test');
const {
  API_URL,
  CLIENT_URL,
  CLIENT_PORT,
  CLIENT_DIR,
} = require('./test-env');

module.exports = defineConfig({
  testDir: './tests',
  // The API enforces per-IP rate limits with a shared in-process store, so
  // parallel workers would compete for the same buckets and fail each other
  // intermittently. A single worker trades a little wall-clock for runs whose
  // failures always mean something.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),

  use: {
    baseURL: CLIENT_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.js/,
      use: { baseURL: API_URL },
    },
    {
      name: 'browser',
      testMatch: /.*\.ui\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Only the client is managed here. The API is started in globalSetup
  // instead, because webServer launches before globalSetup - i.e. before the
  // test database it needs has been created.
  webServer: {
    command: `npx vite --port ${CLIENT_PORT} --strictPort`,
    cwd: CLIENT_DIR,
    url: CLIENT_URL,
    env: { ...process.env, VITE_API_URL: API_URL },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

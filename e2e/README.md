# ZenithDesk E2E suite

Playwright tests for the main app - API-level checks and browser flows.

## Running

```bash
cd e2e && npm install && npx playwright install chromium   # first time only
npm test            # everything
npm run test:api    # API only (fast)
npm run test:ui     # browser only
npm run report      # open the HTML report from the last CI-style run
```

`npm test` from `server/` runs this same suite.

## What it assumes

Database credentials come from the environment, falling back to `server/.env`
(`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`) - which is how the same suite
runs locally and in CI, where there is no `.env` file. Nothing else is taken
from your environment: ports, the JWT secret and the schema name are all fixed
in `test-env.js`.

## How a run works

1. `global-setup.js` drops and recreates the `zenithdesk_e2e` schema, runs the
   Knex migrations against it, starts the API on **:7100**, and waits for
   `/health`.
2. Playwright starts the Vite client on **:5200** pointed at that API.
3. Tests run on a single worker.
4. `global-teardown.js` stops the API.

Your dev database and your dev servers on :3000/:5173 are never touched.

## Things worth knowing before adding tests

Every test builds its own data. Seeded emails are randomised by Faker, and
tests that share an org interfere through org-scoped lists, so use `createOrg`
and `createTicket` from `helpers.js`.

Declare an end-user IP. The API rate-limits per IP, so without one the whole
suite shares a single five-request OTP bucket. `helpers.js` sends
`X-ZenithDesk-Client-IP` with a unique value per call, and browser specs set it
per context via `test.use({ extraHTTPHeaders })`. The API honours that header
only from `TRUSTED_SERVICE_IPS`, the same mechanism the chatbot uses so the
limits apply per person rather than per calling host.

OTPs come from the log. With no `RESEND_API_KEY` the server logs the code
instead of emailing it, and `readOtpFromLog(email)` reads it out of the API's
captured output. That is why the API is started by hand rather than through
Playwright's `webServer`: `webServer` starts before `globalSetup`, i.e. before
the database exists, and its output isn't readable from a test.

One worker, on purpose. The rate limiters keep their counters in-process, so
parallel workers compete for the same buckets and fail each other at random.

## Coverage

| Spec | Covers |
|---|---|
| `auth-boundaries.api.spec.js` | Token audience separation (the escalation bug fixed in `b51f3d2`), tenant isolation, admin-only routes, unauthenticated access |
| `rate-limits.api.spec.js` | Login/OTP throttling, per-end-user buckets, body validation, password policy, helmet headers, CORS allowlist |
| `agent-flow.ui.spec.js` | Agent login, ticket list and detail, posting a reply, stale-token sign-out and recovery |
| `customer-portal.ui.spec.js` | OTP sign-in end to end, wrong code, unknown email, unverified access |

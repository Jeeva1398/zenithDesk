const fs = require('fs');
const { API_URL, SERVER_LOG } = require('./test-env');

let counter = 0;

// Every test builds its own org rather than leaning on seed data: seeded
// emails are randomised by Faker, and tests that share an org interfere
// through org-scoped lists and rate-limit buckets.
function unique(prefix) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

const PASSWORD = 'e2e-password-123';

// Each caller gets a distinct synthetic end-user IP, which the API trusts from
// 127.0.0.1 (TRUSTED_SERVICE_IPS in test-env), so per-IP limits apply per test
// instead of draining one bucket shared by the whole suite.
function uniqueClientIp() {
  counter += 1;
  return `198.51.${Math.floor(counter / 256) % 256}.${counter % 256}`;
}

/** Signs up a fresh organization and returns its admin agent token. */
async function createOrg(request, overrides = {}) {
  const orgName = unique('Org');
  const adminEmail = `${unique('admin')}@example.com`;

  const res = await request.post(`${API_URL}/organizations/signup`, {
    headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
    data: {
      orgName,
      adminName: 'E2E Admin',
      adminEmail,
      adminPassword: PASSWORD,
      ...overrides,
    },
  });

  if (!res.ok()) {
    throw new Error(`signup failed (${res.status()}): ${await res.text()}`);
  }

  const body = await res.json();
  return { ...body, orgName, adminEmail, password: PASSWORD };
}

/** Creates a ticket in the given org, which also creates its customer row. */
async function createTicket(request, token, overrides = {}) {
  const customerEmail = overrides.customerEmail || `${unique('customer')}@example.com`;

  const res = await request.post(`${API_URL}/tickets`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-ZenithDesk-Client-IP': uniqueClientIp(),
    },
    data: {
      customerName: 'E2E Customer',
      customerEmail,
      subject: unique('Subject'),
      description: 'Raised by the end-to-end suite.',
      category: 'technical',
      priority: 'medium',
      ...overrides,
    },
  });

  if (!res.ok()) {
    throw new Error(`ticket creation failed (${res.status()}): ${await res.text()}`);
  }

  return { ...(await res.json()), customerEmail };
}

/**
 * Reads the verification code the server logs when no mail provider is
 * configured. Polls because the log write races the HTTP response.
 */
async function readOtpFromLog(email, { timeoutMs = 5000 } = {}) {
  const pattern = new RegExp(
    `logging OTP instead of emailing ${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: (\\d{6})`,
  );
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const log = fs.existsSync(SERVER_LOG) ? fs.readFileSync(SERVER_LOG, 'utf8') : '';
    // Last match wins: a resend for the same address supersedes earlier codes.
    const matches = [...log.matchAll(new RegExp(pattern, 'g'))];
    if (matches.length > 0) {
      return matches[matches.length - 1][1];
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`No OTP logged for ${email} within ${timeoutMs}ms`);
}

/** Full customer login: request a code, read it from the log, exchange it. */
async function loginCustomer(request, email) {
  const clientIp = uniqueClientIp();
  const headers = { 'X-ZenithDesk-Client-IP': clientIp };

  const orgRes = await request.post(`${API_URL}/customer-auth/resolve-org`, {
    headers,
    data: { email },
  });
  if (!orgRes.ok()) {
    throw new Error(`resolve-org failed (${orgRes.status()}): ${await orgRes.text()}`);
  }
  const { orgId } = await orgRes.json();

  const requestRes = await request.post(`${API_URL}/customer-auth/request-otp`, {
    headers,
    data: { orgId, email },
  });
  if (!requestRes.ok()) {
    throw new Error(`request-otp failed (${requestRes.status()}): ${await requestRes.text()}`);
  }

  const code = await readOtpFromLog(email);

  const verifyRes = await request.post(`${API_URL}/customer-auth/verify-otp`, {
    headers,
    data: { orgId, email, code },
  });
  if (!verifyRes.ok()) {
    throw new Error(`verify-otp failed (${verifyRes.status()}): ${await verifyRes.text()}`);
  }

  return { ...(await verifyRes.json()), orgId, code, clientIp };
}

module.exports = {
  API_URL,
  PASSWORD,
  unique,
  uniqueClientIp,
  createOrg,
  createTicket,
  readOtpFromLog,
  loginCustomer,
};

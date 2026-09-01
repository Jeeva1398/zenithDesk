import request from './client';

export function resolveOrg({ email }) {
  return request('/customer-auth/resolve-org', { method: 'POST', body: { email } });
}

export function requestOtp({ orgId, email }) {
  return request('/customer-auth/request-otp', { method: 'POST', body: { orgId, email } });
}

export function verifyOtp({ orgId, email, code }) {
  return request('/customer-auth/verify-otp', { method: 'POST', body: { orgId, email, code } });
}

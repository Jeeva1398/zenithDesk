import request from './client';

export function signup({ orgName, adminName, adminEmail, adminPassword }) {
  return request('/organizations/signup', {
    method: 'POST',
    body: { orgName, adminName, adminEmail, adminPassword },
  });
}

export function login({ email, password }) {
  return request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

// Always resolves the same way, whether or not the email has an account.
export function requestPasswordReset(email) {
  return request('/auth/forgot-password', { method: 'POST', body: { email } });
}

export function resetPassword({ token, password }) {
  return request('/auth/reset-password', { method: 'POST', body: { token, password } });
}

export function refreshSession(refreshToken) {
  return request('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
}

export function logoutSession(refreshToken) {
  return request('/auth/logout', {
    method: 'POST',
    body: { refreshToken },
  });
}

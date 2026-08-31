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

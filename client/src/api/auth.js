import request from './client';

export function register({ orgName, name, email, password }) {
  return request('/auth/register', {
    method: 'POST',
    body: { orgName, name, email, password },
  });
}

export function login({ email, password }) {
  return request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

import request from './client';

export function listSlaPolicies(token) {
  return request('/sla/policies', { token });
}

export function updateSlaPolicy(token, id, data) {
  return request(`/sla/policies/${id}`, { method: 'PATCH', body: data, token });
}

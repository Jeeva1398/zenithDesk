import request from './client';

export function listAgents(token) {
  return request('/agents', { token });
}

export function createAgent(token, data) {
  return request('/agents', { method: 'POST', body: data, token });
}

export function updateAgent(token, id, updates) {
  return request(`/agents/${id}`, { method: 'PATCH', body: updates, token });
}

export function deleteAgent(token, id) {
  return request(`/agents/${id}`, { method: 'DELETE', token });
}

export function updateMyProfile(token, updates) {
  return request('/agents/me', { method: 'PATCH', body: updates, token });
}

export function changeMyPassword(token, data) {
  return request('/agents/me/password', { method: 'PATCH', body: data, token });
}

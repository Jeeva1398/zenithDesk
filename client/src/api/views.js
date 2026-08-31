import request from './client';

export function listViews(token) {
  return request('/views', { token });
}

export function createView(token, data) {
  return request('/views', { method: 'POST', body: data, token });
}

export function updateView(token, id, data) {
  return request(`/views/${id}`, { method: 'PATCH', body: data, token });
}

export function deleteView(token, id) {
  return request(`/views/${id}`, { method: 'DELETE', token });
}

import request from './client';

export function createTicket(token, data) {
  return request('/tickets', { method: 'POST', body: data, token });
}

export function listTickets(token, filters = {}) {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
  );
  const query = params.toString();
  return request(`/tickets${query ? `?${query}` : ''}`, { token });
}

export function getTicket(token, id) {
  return request(`/tickets/${id}`, { token });
}

export function updateTicket(token, id, updates) {
  return request(`/tickets/${id}`, { method: 'PATCH', body: updates, token });
}

export function addComment(token, id, body) {
  return request(`/tickets/${id}/comments`, { method: 'POST', body: { body }, token });
}

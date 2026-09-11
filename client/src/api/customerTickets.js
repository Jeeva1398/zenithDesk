import request from './client';

export function listMyTickets(token) {
  return request('/customer/tickets', { token });
}

export function getMyTicket(token, id) {
  return request(`/customer/tickets/${id}`, { token });
}

export function createMyTicket(token, data) {
  return request('/customer/tickets', { method: 'POST', body: data, token });
}

export function addMyComment(token, id, body) {
  return request(`/customer/tickets/${id}/comments`, { method: 'POST', body: { body }, token });
}

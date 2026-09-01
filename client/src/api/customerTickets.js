import request from './client';

export function listMyTickets(token) {
  return request('/customer/tickets', { token });
}

export function getMyTicket(token, id) {
  return request(`/customer/tickets/${id}`, { token });
}

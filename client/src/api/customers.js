import request from './client';

export function listCustomers(token) {
  return request('/customers', { token });
}

export function getCustomer(token, id) {
  return request(`/customers/${id}`, { token });
}

export function createCustomer(token, data) {
  return request('/customers', { method: 'POST', body: data, token });
}

export function updateCustomer(token, id, updates) {
  return request(`/customers/${id}`, { method: 'PATCH', body: updates, token });
}

export function deleteCustomer(token, id) {
  return request(`/customers/${id}`, { method: 'DELETE', token });
}

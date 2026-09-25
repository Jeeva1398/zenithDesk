import request from './client';

export function listEnquiries(token, { status, q, page } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  if (page && page > 1) params.set('page', String(page));
  const query = params.toString();
  return request(`/enquiries${query ? `?${query}` : ''}`, { token });
}

export function getEnquiry(token, id) {
  return request(`/enquiries/${id}`, { token });
}

export function updateEnquiry(token, id, data) {
  return request(`/enquiries/${id}`, { method: 'PATCH', body: data, token });
}

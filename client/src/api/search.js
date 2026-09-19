import request from './client';

export function search(token, q, limit) {
  const params = new URLSearchParams({ q });
  if (limit) params.set('limit', String(limit));
  return request(`/search?${params.toString()}`, { token });
}

import request from './client';

export function getMyOrganization(token) {
  return request('/organizations/me', { token });
}

export function enableProduct(token, product) {
  return request('/organizations/me/products', { method: 'POST', body: { product }, token });
}

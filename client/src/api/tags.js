import request from './client';

export function listTags(token) {
  return request('/tags', { token });
}

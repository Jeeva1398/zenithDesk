import request from './client';

export function listAgents(token) {
  return request('/agents', { token });
}

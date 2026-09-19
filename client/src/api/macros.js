import request from './client';

export function listMacros(token) {
  return request('/macros', { token });
}

export function createMacro(token, data) {
  return request('/macros', { method: 'POST', body: data, token });
}

export function updateMacro(token, id, data) {
  return request(`/macros/${id}`, { method: 'PATCH', body: data, token });
}

export function deleteMacro(token, id) {
  return request(`/macros/${id}`, { method: 'DELETE', token });
}

export function applyMacro(token, ticketId, macroId) {
  return request(`/tickets/${ticketId}/apply-macro`, {
    method: 'POST',
    body: { macroId },
    token,
  });
}

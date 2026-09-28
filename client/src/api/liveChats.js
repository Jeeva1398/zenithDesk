import request from './client';

// { enabled, waiting, active, online } - also the agent's check-in, which is
// how the chatbot knows someone is around to answer.
export function getLiveChatCounts(token) {
  return request('/live-chats/counts', { token });
}

// { open, recent }
export function listLiveChats(token) {
  return request('/live-chats', { token });
}

export function getLiveChat(token, id) {
  return request(`/live-chats/${id}`, { token });
}

// { chat, messages } - messages newer than `after`.
export function listLiveChatMessages(token, id, after = 0) {
  return request(`/live-chats/${id}/messages?after=${after}`, { token });
}

export function sendLiveChatMessage(token, id, body) {
  return request(`/live-chats/${id}/messages`, { method: 'POST', body: { body }, token });
}

export function joinLiveChat(token, id) {
  return request(`/live-chats/${id}/join`, { method: 'POST', token });
}

export function closeLiveChat(token, id) {
  return request(`/live-chats/${id}/close`, { method: 'POST', token });
}

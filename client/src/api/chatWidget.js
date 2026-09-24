import request from './client';

export function getChatWidgetSettings(token) {
  return request('/chat-widget', { token });
}

export function updateChatWidgetSettings(token, data) {
  return request('/chat-widget', { method: 'PATCH', body: data, token });
}

export function regenerateChatWidgetKey(token) {
  return request('/chat-widget/regenerate-key', { method: 'POST', token });
}

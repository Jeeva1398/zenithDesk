import request from './client';

export function listArticles(token) {
  return request('/knowledge/articles', { token });
}

export function createArticle(token, data) {
  return request('/knowledge/articles', { method: 'POST', body: data, token });
}

export function updateArticle(token, id, data) {
  return request(`/knowledge/articles/${id}`, { method: 'PATCH', body: data, token });
}

export function deleteArticle(token, id) {
  return request(`/knowledge/articles/${id}`, { method: 'DELETE', token });
}

export function searchKnowledge(token, query) {
  return request('/knowledge/search', { method: 'POST', body: { query }, token });
}

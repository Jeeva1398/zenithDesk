import request from './client';

export function getOverview(token, days = 30) {
  return request(`/analytics/overview?days=${days}`, { token });
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export class ApiClientError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

// A token can stop being valid mid-session — it expires, or the server starts
// rejecting the shape it was issued in. Without a global hook, each page just
// renders its own error while the app still believes someone is signed in,
// which reads as "the app is broken" rather than "you were signed out".
// Subscribers are handed the token that failed so the agent and customer
// sessions, which are independent, only clear their own.
const unauthorizedHandlers = new Set();

export function onUnauthorized(handler) {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Only for calls that actually presented a token — a 401 from a login
    // attempt is a wrong password, not an expired session.
    if (res.status === 401 && token) {
      unauthorizedHandlers.forEach((handler) => handler(token));
    }
    throw new ApiClientError(res.status, data.error || 'Request failed');
  }

  return data;
}

export default request;

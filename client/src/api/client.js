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

// The access token is short-lived now, so an expired one is the ordinary case
// rather than a sign the session is over. A handler registered here is given
// the token that failed and returns a fresh one, or null if the session really
// is finished.
let refreshHandler = null;
let inFlightRefresh = null;

export function setRefreshHandler(handler) {
  refreshHandler = handler;
  return () => {
    if (refreshHandler === handler) refreshHandler = null;
  };
}

// One refresh at a time. A page typically fires several requests together, so
// they expire together - and each of them rotating the refresh token on its own
// would spend it more than once, which the server reads as a stolen token and
// answers by cutting every session the agent has.
function refreshOnce(failedToken) {
  if (!inFlightRefresh) {
    inFlightRefresh = Promise.resolve(refreshHandler(failedToken)).finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

async function request(path, { method = 'GET', body, token, retried = false } = {}) {
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
      // Try once to renew and replay. Only the original attempt may do this:
      // a 401 on the replay means the new token was rejected too, and retrying
      // again would loop.
      if (refreshHandler && !retried) {
        const renewed = await refreshOnce(token).catch(() => null);
        if (renewed && renewed !== token) {
          return request(path, { method, body, token: renewed, retried: true });
        }
      }
      unauthorizedHandlers.forEach((handler) => handler(token));
    }
    throw new ApiClientError(res.status, data.error || 'Request failed');
  }

  return data;
}

export default request;

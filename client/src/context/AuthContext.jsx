import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onUnauthorized, setRefreshHandler } from '../api/client';
import { logoutSession, refreshSession } from '../api/auth';

const AuthContext = createContext(null);

const STORAGE_KEY = 'zenithdesk_auth';

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStoredAuth);

  const login = (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setAuth(data);
  };

  // Clears this browser first and revokes on the server afterwards, so a failed
  // or slow network call cannot leave someone looking signed in on a machine
  // they just signed out of. The revoke is best effort; if it never lands the
  // token still expires on its own.
  const logout = () => {
    const refreshToken = refreshTokenRef.current;
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
    if (refreshToken) {
      logoutSession(refreshToken).catch(() => {});
    }
  };

  // Read through a ref so the subscription can be registered once rather than
  // re-registered on every token change.
  const tokenRef = useRef(auth?.token ?? null);
  tokenRef.current = auth?.token ?? null;
  const refreshTokenRef = useRef(auth?.refreshToken ?? null);
  refreshTokenRef.current = auth?.refreshToken ?? null;

  useEffect(
    () =>
      onUnauthorized((failedToken) => {
        if (failedToken === tokenRef.current) {
          logout();
        }
      }),
    [],
  );

  // Renews the access token in place when one expires mid-session, so a short
  // TTL costs nobody a re-login. Returns null when there is nothing to renew
  // with, or when the token that failed is not this session's - the customer
  // portal runs alongside and must not be renewed from here.
  useEffect(
    () =>
      setRefreshHandler(async (failedToken) => {
        if (failedToken !== tokenRef.current || !refreshTokenRef.current) {
          return null;
        }
        try {
          const data = await refreshSession(refreshTokenRef.current);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          setAuth(data);
          return data.token;
        } catch {
          return null;
        }
      }),
    [],
  );

  const updateAgent = (updates) => {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, agent: { ...prev.agent, ...updates } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const value = useMemo(
    () => ({
      token: auth?.token ?? null,
      agent: auth?.agent ?? null,
      isAuthenticated: Boolean(auth?.token),
      login,
      logout,
      updateAgent,
    }),
    [auth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

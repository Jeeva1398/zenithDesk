import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onUnauthorized } from '../api/client';

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

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  };

  // Read through a ref so the subscription can be registered once rather than
  // re-registered on every token change.
  const tokenRef = useRef(auth?.token ?? null);
  tokenRef.current = auth?.token ?? null;

  useEffect(
    () =>
      onUnauthorized((failedToken) => {
        if (failedToken === tokenRef.current) {
          logout();
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

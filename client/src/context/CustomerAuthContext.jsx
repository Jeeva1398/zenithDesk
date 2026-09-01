import { createContext, useContext, useMemo, useState } from 'react';

const CustomerAuthContext = createContext(null);

const STORAGE_KEY = 'zenithdesk_customer_auth';

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function CustomerAuthProvider({ children }) {
  const [auth, setAuth] = useState(readStoredAuth);

  const login = (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setAuth(data);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  };

  const value = useMemo(
    () => ({
      token: auth?.token ?? null,
      email: auth?.email ?? null,
      orgName: auth?.orgName ?? null,
      isAuthenticated: Boolean(auth?.token),
      login,
      logout,
    }),
    [auth],
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
}

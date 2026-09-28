import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getLiveChatCounts } from '../api/liveChats';
import { useAuth } from './AuthContext';

// Checked every few seconds from anywhere in the portal: it drives the Live
// chat badge, and each check tells the server this agent is still here, so a
// visitor asking for a person is only offered one while someone is.
const POLL_MS = 15000;
const EMPTY = { enabled: false, waiting: 0, active: 0, online: 0 };

const LiveChatContext = createContext({ counts: EMPTY, refresh: () => {} });

export function LiveChatProvider({ children }) {
  const { token } = useAuth();
  const [counts, setCounts] = useState(EMPTY);

  const refresh = useCallback(() => {
    if (!token) return;
    getLiveChatCounts(token)
      .then(setCounts)
      .catch(() => {
        // Left as it was; the next check tries again.
      });
  }, [token]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // A visitor waiting shows in the browser tab too, for an agent working in
  // another window.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, '');
    document.title = counts.waiting > 0 ? `(${counts.waiting}) ${base}` : base;
  }, [counts.waiting]);

  return <LiveChatContext.Provider value={{ counts, refresh }}>{children}</LiveChatContext.Provider>;
}

export function useLiveChat() {
  return useContext(LiveChatContext);
}

type ChatSessionEntry<TChat> = {
  chat: TChat;
  lastActiveAt: number;
};

type SessionManagerOptions = {
  ttlMs: number;
  maxSize: number;
  cleanupIntervalMs: number;
};

export const createSessionManager = <TChat>(
  startChat: () => TChat,
  options: SessionManagerOptions,
) => {
  const chatSessions = new Map<number, ChatSessionEntry<TChat>>();

  const touchSession = (userId: number, chat: TChat) => {
    chatSessions.set(userId, {
      chat,
      lastActiveAt: Date.now(),
    });
  };

  const cleanupExpiredSessions = () => {
    const now = Date.now();

    for (const [userId, entry] of chatSessions.entries()) {
      if (now - entry.lastActiveAt > options.ttlMs) {
        chatSessions.delete(userId);
      }
    }

    if (chatSessions.size <= options.maxSize) {
      return;
    }

    const overflow = chatSessions.size - options.maxSize;
    const oldestEntries = [...chatSessions.entries()]
      .sort((a, b) => a[1].lastActiveAt - b[1].lastActiveAt)
      .slice(0, overflow);

    for (const [userId] of oldestEntries) {
      chatSessions.delete(userId);
    }
  };

  const cleanupTimer = setInterval(
    cleanupExpiredSessions,
    options.cleanupIntervalMs,
  );
  cleanupTimer.unref?.();

  const getOrCreateSession = (userId: number) => {
    cleanupExpiredSessions();

    const existingSession = chatSessions.get(userId);
    if (existingSession) {
      touchSession(userId, existingSession.chat);
      return existingSession.chat;
    }

    const newSession = startChat();
    touchSession(userId, newSession);
    return newSession;
  };

  return {
    getOrCreateSession,
  };
};

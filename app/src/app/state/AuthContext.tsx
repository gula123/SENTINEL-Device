import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { logoutMobileSession, refreshMobileSession } from "../services/auth/authApi";
import { getMobileSessionMetadata } from "../services/auth/deviceSession";
import { restoreBackendSessionSilently } from "../services/auth/nativeGoogleSession";
import { storage } from "../services/storage/secureStorage";
import { getTokenRemainingTime, isTokenExpired } from "../utils/tokenUtils";

const AUTH_TOKEN_KEY = "authToken";
const AUTH_USER_KEY = "authUser";
const AUTH_REFRESH_TOKEN_KEY = "authRefreshToken";

export interface AuthUser {
  userId: number;
  email: string;
  name: string;
  profilePictureUrl: string;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isHydrating: boolean;
  isAuthenticated: boolean;
  saveSession: (tokenValue: string, userValue?: AuthUser | null, refreshTokenValue?: string | null) => Promise<void>;
  refreshSession: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  const parseStoredUser = useCallback((value: string | null): AuthUser | null => {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as AuthUser;
    } catch {
      return null;
    }
  }, []);

  const clearSession = useCallback(async () => {
    await storage.removeItem(AUTH_TOKEN_KEY);
    await storage.removeItem(AUTH_USER_KEY);
    await storage.removeItem(AUTH_REFRESH_TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const saveSession = useCallback(async (tokenValue: string, userValue?: AuthUser | null, refreshTokenValue?: string | null) => {
    await storage.setItem(AUTH_TOKEN_KEY, tokenValue);
    if (userValue) {
      await storage.setItem(AUTH_USER_KEY, JSON.stringify(userValue));
      setUser(userValue);
    }
    if (refreshTokenValue) {
      await storage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshTokenValue);
    }
    setToken(tokenValue);
  }, []);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    const storedRefreshToken = await storage.getItem(AUTH_REFRESH_TOKEN_KEY);
    if (storedRefreshToken) {
      try {
        const sessionMetadata = await getMobileSessionMetadata();
        const refreshedSession = await refreshMobileSession(storedRefreshToken, sessionMetadata);
        await saveSession(
          refreshedSession.token,
          {
            userId: refreshedSession.userId,
            email: refreshedSession.email,
            name: refreshedSession.name,
            profilePictureUrl: refreshedSession.profilePictureUrl,
          },
          refreshedSession.refreshToken ?? null
        );
        return refreshedSession.token;
      } catch {
        await storage.removeItem(AUTH_REFRESH_TOKEN_KEY);
      }
    }

    const silentSession = await restoreBackendSessionSilently();
    if (!silentSession) {
      return null;
    }

    await saveSession(
      silentSession.token,
      {
        userId: silentSession.userId,
        email: silentSession.email,
        name: silentSession.name,
        profilePictureUrl: silentSession.profilePictureUrl,
      },
      silentSession.refreshToken ?? null
    );

    return silentSession.token;
  }, [saveSession]);

  const restoreSession = useCallback(async () => {
    const storedToken = await storage.getItem(AUTH_TOKEN_KEY);
    const storedUser = await storage.getItem(AUTH_USER_KEY);

    if (storedToken && !isTokenExpired(storedToken)) {
      setToken(storedToken);
      setUser(parseStoredUser(storedUser));
      return;
    }

    if (storedToken) {
      const refreshedToken = await refreshSession();
      if (refreshedToken) {
        return;
      }
    }

    await clearSession();
  }, [clearSession, parseStoredUser, refreshSession]);

  const signOut = useCallback(async () => {
    const storedRefreshToken = await storage.getItem(AUTH_REFRESH_TOKEN_KEY);
    if (storedRefreshToken) {
      try {
        await logoutMobileSession(storedRefreshToken);
      } catch {
        // Ignore logout network failures and clear the local session anyway.
      }
    }

    await clearSession();
  }, [clearSession]);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      try {
        await restoreSession();
      } finally {
        if (active) {
          setIsHydrating(false);
        }
      }
    };

    hydrate();

    return () => {
      active = false;
    };
  }, [restoreSession]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const refreshAtMs = Math.max(0, getTokenRemainingTime(token) - 60) * 1000;

    const timerId = setTimeout(async () => {
      const refreshedToken = await refreshSession();
      if (refreshedToken) {
        return;
      }

      await signOut();
    }, refreshAtMs);

    return () => {
      clearTimeout(timerId);
    };
  }, [saveSession, signOut, token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isHydrating,
      isAuthenticated: Boolean(token),
      saveSession,
      refreshSession,
      signOut,
    }),
    [token, user, isHydrating, saveSession, refreshSession, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

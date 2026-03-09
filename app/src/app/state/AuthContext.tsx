import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { storage } from "../services/storage/secureStorage";

const AUTH_TOKEN_KEY = "authToken";
const AUTH_USER_KEY = "authUser";

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
  saveSession: (tokenValue: string, userValue?: AuthUser | null) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      try {
        const stored = await storage.getItem(AUTH_TOKEN_KEY);
        const storedUser = await storage.getItem(AUTH_USER_KEY);
        if (active) {
          setToken(stored);
          setUser(storedUser ? JSON.parse(storedUser) as AuthUser : null);
        }
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
  }, []);

  const saveSession = async (tokenValue: string, userValue?: AuthUser | null) => {
    await storage.setItem(AUTH_TOKEN_KEY, tokenValue);
    if (userValue) {
      await storage.setItem(AUTH_USER_KEY, JSON.stringify(userValue));
      setUser(userValue);
    }
    setToken(tokenValue);
  };

  const signOut = async () => {
    await storage.removeItem(AUTH_TOKEN_KEY);
    await storage.removeItem(AUTH_USER_KEY);
    setToken(null);
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isHydrating,
      isAuthenticated: Boolean(token),
      saveSession,
      signOut,
    }),
    [token, user, isHydrating]
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

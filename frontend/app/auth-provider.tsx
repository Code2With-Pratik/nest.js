"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch, getErrorMessage, refreshSession, setAccessToken } from "@/lib/api";
import type { AuthSession, User } from "@/types/api";

interface Credentials {
  email: string;
  password: string;
}

interface Registration extends Credentials {
  name: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  bootstrapError: string | null;
  signIn: (credentials: Credentials) => Promise<void>;
  signUp: (registration: Registration) => Promise<void>;
  signOut: () => Promise<void>;
  retrySession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const retrySession = useCallback(async () => {
    setIsLoading(true);
    setBootstrapError(null);
    try {
      const session = await refreshSession();
      setUser(session?.user ?? null);
    } catch (error) {
      setAccessToken(null);
      setBootstrapError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void retrySession();
  }, [retrySession]);

  const signIn = useCallback(async (credentials: Credentials) => {
    const session = await apiFetch<AuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    setAccessToken(session.accessToken);
    setUser(session.user);
    setBootstrapError(null);
  }, []);

  const signUp = useCallback(async (registration: Registration) => {
    const session = await apiFetch<AuthSession>("/auth/register", {
      method: "POST",
      body: JSON.stringify(registration),
    });
    setAccessToken(session.accessToken);
    setUser(session.user);
    setBootstrapError(null);
  }, []);

  const signOut = useCallback(async () => {
    await apiFetch<void>("/auth/logout", { method: "POST" });
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      bootstrapError,
      signIn,
      signUp,
      signOut,
      retrySession,
    }),
    [
      user,
      isLoading,
      bootstrapError,
      signIn,
      signUp,
      signOut,
      retrySession,
    ],
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

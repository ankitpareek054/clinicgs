"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../lib/api/api";
import { normalizeSessionPayload } from "../lib/auth/auth";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [error, setError] = useState("");

  const refreshSession = useCallback(async () => {
    try {
      const payload = await api.get("/auth/me");
      const normalizedUser = normalizeSessionPayload(payload);

      if (!normalizedUser) {
        throw new Error("Could not read the logged-in user from /auth/me.");
      }

      setUser(normalizedUser);
      setError("");
      return normalizedUser;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setError("");
        return null;
      }

      setUser(null);
      setError(err.message || "Could not load your session.");
      throw err;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const payload = await api.get("/auth/me");
        if (cancelled) return;

        const normalizedUser = normalizeSessionPayload(payload);
        setUser(normalizedUser);
        setError("");
      } catch (err) {
        if (cancelled) return;

        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
          setError("");
        } else {
          setUser(null);
          setError(err.message || "Could not load your session.");
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(credentials) {
    setError("");
    await api.post("/auth/login", credentials);
    return refreshSession();
  }

  async function logout() {
    try {
      await api.post("/auth/logout", {});
    } catch (err) {
      // clear frontend session even if backend logout response fails
    } finally {
      setUser(null);
      setError("");
    }
  }

  const value = useMemo(() => {
    return {
      user,
      error,
      isBootstrapping,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshSession,
    };
  }, [user, error, isBootstrapping, refreshSession]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useAuth() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useAuth must be used inside SessionProvider.");
  }

  return context;
}

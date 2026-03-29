"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, ApiError } from "../lib/api/api";
import { normalizeSessionPayload } from "../lib/auth/auth";

const SessionContext = createContext(null);

const ADMIN_CLINIC_STORAGE_KEY = "cgs.selectedAdminClinic";

function normalizeAdminClinicSelection(clinic) {
  if (!clinic || typeof clinic !== "object") {
    return null;
  }

  const id = clinic.id ?? clinic.clinic_id ?? clinic.clinicId ?? null;

  if (!id) {
    return null;
  }

  return {
    id,
    name:
      clinic.name ||
      clinic.clinic_name ||
      clinic.clinicName ||
      clinic.title ||
      "",
    status: clinic.status || "",
    city: clinic.city || clinic.location_city || clinic.locationCity || "",
  };
}

function readStoredAdminClinic() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(ADMIN_CLINIC_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    return normalizeAdminClinicSelection(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

function writeStoredAdminClinic(clinic) {
  if (typeof window === "undefined") {
    return;
  }

  if (!clinic) {
    window.localStorage.removeItem(ADMIN_CLINIC_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    ADMIN_CLINIC_STORAGE_KEY,
    JSON.stringify(clinic)
  );
}

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [error, setError] = useState("");
  const [selectedAdminClinic, setSelectedAdminClinic] = useState(() =>
    readStoredAdminClinic()
  );

  const clearAdminClinic = useCallback(() => {
    setSelectedAdminClinic(null);
    writeStoredAdminClinic(null);
  }, []);

  const setAdminClinic = useCallback((clinic) => {
    const normalizedClinic = normalizeAdminClinicSelection(clinic);

    if (!normalizedClinic) {
      setSelectedAdminClinic(null);
      writeStoredAdminClinic(null);
      return null;
    }

    setSelectedAdminClinic(normalizedClinic);
    writeStoredAdminClinic(normalizedClinic);
    return normalizedClinic;
  }, []);

  const syncAdminClinicForUser = useCallback(
    (nextUser) => {
      if (!nextUser || nextUser.role !== "super_admin") {
        clearAdminClinic();
        return null;
      }

      const storedClinic = readStoredAdminClinic();

      if (!storedClinic) {
        setSelectedAdminClinic(null);
        return null;
      }

      setSelectedAdminClinic((currentClinic) => {
        if (
          currentClinic &&
          currentClinic.id === storedClinic.id &&
          currentClinic.name === storedClinic.name &&
          currentClinic.status === storedClinic.status &&
          currentClinic.city === storedClinic.city
        ) {
          return currentClinic;
        }

        return storedClinic;
      });

      return storedClinic;
    },
    [clearAdminClinic]
  );

  const refreshSession = useCallback(async () => {
    try {
      const payload = await api.get("/auth/me");
      const normalizedUser = normalizeSessionPayload(payload);

      if (!normalizedUser) {
        throw new Error("Could not read the logged-in user from /auth/me.");
      }

      setUser(normalizedUser);
      setError("");
      syncAdminClinicForUser(normalizedUser);
      return normalizedUser;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setError("");
        clearAdminClinic();
        return null;
      }

      setUser(null);
      setError(err.message || "Could not load your session.");
      throw err;
    }
  }, [clearAdminClinic, syncAdminClinicForUser]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const payload = await api.get("/auth/me");
        if (cancelled) return;

        const normalizedUser = normalizeSessionPayload(payload);
        setUser(normalizedUser);
        setError("");
        syncAdminClinicForUser(normalizedUser);
      } catch (err) {
        if (cancelled) return;

        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
          setError("");
          clearAdminClinic();
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
  }, [clearAdminClinic, syncAdminClinicForUser]);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    if (user?.role !== "super_admin") {
      clearAdminClinic();
      return;
    }

    const storedClinic = readStoredAdminClinic();

    if (!storedClinic) {
      if (selectedAdminClinic) {
        setSelectedAdminClinic(null);
      }
      return;
    }

    if (
      !selectedAdminClinic ||
      selectedAdminClinic.id !== storedClinic.id ||
      selectedAdminClinic.name !== storedClinic.name ||
      selectedAdminClinic.status !== storedClinic.status ||
      selectedAdminClinic.city !== storedClinic.city
    ) {
      setSelectedAdminClinic(storedClinic);
    }
  }, [user?.role, isBootstrapping, selectedAdminClinic, clearAdminClinic]);

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
      clearAdminClinic();
    }
  }

  const adminWorkspaceMode =
    user?.role === "super_admin"
      ? selectedAdminClinic
        ? "selected_clinic"
        : "all_clinics"
      : "own_clinic";

  const effectiveClinicId =
    user?.role === "super_admin"
      ? selectedAdminClinic?.id ?? null
      : user?.clinicId ?? null;

  const effectiveClinicName =
    user?.role === "super_admin"
      ? selectedAdminClinic?.name || ""
      : user?.clinicName || "";

  const value = useMemo(() => {
    return {
      user,
      error,
      isBootstrapping,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshSession,
      selectedAdminClinic,
      selectedAdminClinicId: selectedAdminClinic?.id ?? null,
      adminWorkspaceMode,
      effectiveClinicId,
      effectiveClinicName,
      hasSelectedAdminClinic: Boolean(selectedAdminClinic),
      setAdminClinic,
      clearAdminClinic,
    };
  }, [
    user,
    error,
    isBootstrapping,
    refreshSession,
    selectedAdminClinic,
    adminWorkspaceMode,
    effectiveClinicId,
    effectiveClinicName,
    setAdminClinic,
    clearAdminClinic,
  ]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useAuth must be used inside SessionProvider.");
  }

  return context;
}
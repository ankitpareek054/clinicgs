"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "clinicgs-theme";

const ThemeContext = createContext(null);

function getSystemTheme() {
  if (typeof window === "undefined") return "dark";

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(theme) {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyThemeToDocument(theme) {
  const resolved = resolveTheme(theme);

  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;

  return resolved;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("system");
  const [resolvedTheme, setResolvedTheme] = useState("dark");

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(STORAGE_KEY) || "system";
      setThemeState(savedTheme);
      setResolvedTheme(applyThemeToDocument(savedTheme));
    } catch (error) {
      setThemeState("system");
      setResolvedTheme(applyThemeToDocument("system"));
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function handleSystemThemeChange() {
      if (theme === "system") {
        setResolvedTheme(applyThemeToDocument("system"));
      }
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [theme]);

  function setTheme(nextTheme) {
    setThemeState(nextTheme);
    localStorage.setItem(STORAGE_KEY, nextTheme);
    setResolvedTheme(applyThemeToDocument(nextTheme));
  }

  const value = useMemo(() => {
    return {
      theme,
      resolvedTheme,
      setTheme,
      isDark: resolvedTheme === "dark",
    };
  }, [theme, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return context;
}

"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "clinicgs-theme";
const DEFAULT_THEME = "system";
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

function applyTheme(theme) {
  const resolved = resolveTheme(theme);

  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = theme;
  document.documentElement.style.colorScheme = resolved;

  return resolved;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(DEFAULT_THEME);
  const [resolvedTheme, setResolvedTheme] = useState("dark");
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
    const appliedTheme = applyTheme(savedTheme);

    setThemeState(savedTheme);
    setResolvedTheme(appliedTheme);
    setIsThemeReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function handleSystemThemeChange() {
      if (theme === "system") {
        setResolvedTheme(applyTheme("system"));
      }
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleSystemThemeChange);
    } else {
      mediaQuery.addListener(handleSystemThemeChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleSystemThemeChange);
      } else {
        mediaQuery.removeListener(handleSystemThemeChange);
      }
    };
  }, [theme]);

  function setTheme(nextTheme) {
    localStorage.setItem(STORAGE_KEY, nextTheme);
    setThemeState(nextTheme);
    setResolvedTheme(applyTheme(nextTheme));
  }

  const value = useMemo(() => {
    return {
      theme,
      resolvedTheme,
      isThemeReady,
      setTheme,
      isDark: resolvedTheme === "dark",
      isLight: resolvedTheme === "light",
    };
  }, [theme, resolvedTheme, isThemeReady]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return context;
}
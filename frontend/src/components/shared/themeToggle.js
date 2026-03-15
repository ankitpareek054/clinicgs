"use client";

import { useTheme } from "../../providers/themeProvider";

const options = [
  { value: "light", label: "Light", icon: "☀" },
  { value: "dark", label: "Dark", icon: "☾" },
  { value: "system", label: "System", icon: "◐" },
];

export default function ThemeToggle({ compact = false }) {
  const { theme, resolvedTheme, setTheme, isThemeReady } = useTheme();

  return (
    <div
      className={`theme-switch ${compact ? "compact" : ""}`}
      aria-label="Theme selector"
    >
      {!compact && (
        <div className="theme-switch-copy">
          <span className="theme-switch-label">Theme</span>
          <span className="theme-switch-value">
            {isThemeReady ? `${resolvedTheme} mode active` : "Loading theme..."}
          </span>
        </div>
      )}

      <div className="theme-switch-actions" role="tablist" aria-label="Select theme">
        {options.map((option) => {
          const isActive = theme === option.value;

          return (
            <button
              key={option.value}
              type="button"
              className={`theme-switch-button ${isActive ? "active" : ""}`}
              aria-pressed={isActive}
              title={option.label}
              onClick={() => setTheme(option.value)}
            >
              <span className="theme-switch-icon" aria-hidden="true">
                {option.icon}
              </span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
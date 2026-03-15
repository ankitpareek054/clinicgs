"use client";

import { useTheme } from "../../providers/themeProvider";

const options = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export default function ThemeToggle({ compact = false }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={`theme-switch ${compact ? "compact" : ""}`}>
      {!compact && <span className="theme-switch-label">Theme</span>}

      <div className="theme-switch-actions">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`theme-switch-button ${theme === option.value ? "active" : ""}`}
            onClick={() => setTheme(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

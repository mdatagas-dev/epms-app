"use client";

import { Icon } from "@/components/icons";

export function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const theme = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = theme;
    localStorage.setItem("epms-theme", theme);
  }

  return <button type="button" className="theme-toggle" aria-label="Toggle light or dark mode" onClick={toggleTheme}>
    <span className="theme-toggle-sun"><Icon name="sun" size={16} /></span>
    <span className="theme-toggle-moon"><Icon name="moon" size={16} /></span>
    <span className="theme-toggle-light">Light mode</span>
    <span className="theme-toggle-dark">Dark mode</span>
  </button>;
}

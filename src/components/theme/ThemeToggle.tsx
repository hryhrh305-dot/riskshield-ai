"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "secwyn-theme";

function getDocumentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setTheme(getDocumentTheme()));
    const media = window.matchMedia("(prefers-color-scheme: light)");

    const applyTheme = (nextTheme: Theme) => {
      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.style.colorScheme = nextTheme;
      setTheme(nextTheme);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (event.newValue === "light" || event.newValue === "dark") {
        applyTheme(event.newValue);
      } else {
        applyTheme(media.matches ? "light" : "dark");
      }
    };

    const handleSystemTheme = () => {
      if (!localStorage.getItem(STORAGE_KEY)) applyTheme(media.matches ? "light" : "dark");
    };

    window.addEventListener("storage", handleStorage);
    media.addEventListener("change", handleSystemTheme);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("storage", handleStorage);
      media.removeEventListener("change", handleSystemTheme);
    };
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = getDocumentTheme() === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem(STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
  }

  const isLight = theme === "light";

  return (
    <button
      type="button"
      className="rs-theme-toggle"
      onClick={toggleTheme}
      aria-label={isLight ? "Use dark theme" : "Use light theme"}
      aria-pressed={isLight}
      title={isLight ? "Switch to dark theme" : "Switch to light theme"}
    >
      {isLight ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
      <span>{theme ? `${theme === "light" ? "Light" : "Dark"} mode` : "Theme"}</span>
    </button>
  );
}

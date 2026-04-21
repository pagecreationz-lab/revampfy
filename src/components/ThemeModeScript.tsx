"use client";

import { useLayoutEffect } from "react";

type ThemeModeScriptProps = {
  defaultMode: "dark" | "light";
};

const THEME_STORAGE_KEY = "pcgs_theme_mode";

export function ThemeModeScript({ defaultMode }: ThemeModeScriptProps) {
  useLayoutEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      const mode = stored === "light" || stored === "dark" ? stored : defaultMode;
      const body = document.body;
      if (!body) return;
      body.classList.remove("theme-dark", "theme-light");
      body.classList.add(mode === "light" ? "theme-light" : "theme-dark");
    } catch {
      // Ignore storage access issues and keep server-rendered class.
    }
  }, [defaultMode]);

  return null;
}


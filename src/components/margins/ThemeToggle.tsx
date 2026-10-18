"use client";

import { useLayoutEffect } from "react";
import s from "./margins.module.css";

const KEY = "theme";
type Theme = "light" | "dark";

function systemTheme(): Theme {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function storedTheme(): Theme | null {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

/**
 * Switches between light and dark. Picking the theme the system already uses clears the saved choice,
 * so the site goes back to following the system. The label comes from CSS (.to-dark / .to-light in globals.css).
 */
export default function ThemeToggle() {
  // React's dev remount clears data-theme from <html>; put it back. A no-op in production.
  useLayoutEffect(() => {
    const t = storedTheme();
    if (t) document.documentElement.setAttribute("data-theme", t);
  }, []);

  function toggle() {
    const root = document.documentElement;
    const current = (root.getAttribute("data-theme") as Theme | null) ?? systemTheme();
    const next: Theme = current === "dark" ? "light" : "dark";
    try {
      if (next === systemTheme()) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked: the switch still works for this page view.
    }
    if (next === systemTheme()) root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
  }

  return (
    <button type="button" className={s.toggle} onClick={toggle}>
      <span className="to-dark">Dark theme</span>
      <span className="to-light">Light theme</span>
    </button>
  );
}

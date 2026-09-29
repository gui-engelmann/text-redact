"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // storage unavailable; the theme still applies for this visit
    }
  };

  // Both icons render; CSS shows the one for the active theme, so there's no hydration mismatch.
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      title="Theme"
      className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-accent-soft hover:text-fg"
    >
      <Moon className="size-5 dark:hidden" aria-hidden />
      <Sun className="hidden size-5 dark:block" aria-hidden />
    </button>
  );
}

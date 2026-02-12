import React, { useEffect, useMemo, useState } from "react";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "finanzas.theme";

const getStoredThemeChoice = (): ThemeMode | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
};

const resolveTheme = (themeChoice: ThemeMode | null): ThemeMode => {
  if (themeChoice) {
    return themeChoice;
  }
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ width: 16, height: 16 }}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5V5" />
      <path d="M12 19v2.5" />
      <path d="M4.9 4.9 6.7 6.7" />
      <path d="M17.3 17.3 19.1 19.1" />
      <path d="M2.5 12H5" />
      <path d="M19 12h2.5" />
      <path d="M4.9 19.1 6.7 17.3" />
      <path d="M17.3 6.7 19.1 4.9" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ width: 16, height: 16 }}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 14.1A8.8 8.8 0 1 1 9.9 3a7 7 0 0 0 11.1 11.1Z" />
    </svg>
  );
}

export default function App() {
  const [themeChoice, setThemeChoice] = useState<ThemeMode | null>(getStoredThemeChoice);
  const activeTheme = resolveTheme(themeChoice);
  const isDark = activeTheme === "dark";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolved = themeChoice ?? (media.matches ? "dark" : "light");
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };
    applyTheme();
    if (themeChoice !== null) {
      return;
    }
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [themeChoice]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (themeChoice) {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeChoice);
    } else {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    }
  }, [themeChoice]);

  const styles = useMemo(
    () => ({
      page: {
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        background: isDark ? "#020617" : "#f1f5f9",
        color: isDark ? "#e2e8f0" : "#0f172a",
      },
      card: {
        width: "min(720px, 92vw)",
        padding: 24,
        background: isDark ? "#0f172a" : "#ffffff",
        borderRadius: 16,
        border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
        boxShadow: isDark ? "0 20px 40px rgba(2,6,23,.5)" : "0 8px 24px rgba(15,23,42,.08)",
      },
      topRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        marginBottom: 12,
      },
      switch: {
        display: "inline-flex",
        gap: 4,
        padding: 4,
        borderRadius: 999,
        border: `1px solid ${isDark ? "#334155" : "#dbe7f5"}`,
        background: isDark ? "#0b1220" : "#ffffff",
      },
      chip: (active: boolean) => ({
        width: 36,
        height: 36,
        border: "none",
        borderRadius: 10,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: active ? "#ffffff" : isDark ? "#cbd5e1" : "#334155",
        background: active ? "#0891b2" : "transparent",
      }),
      link: {
        color: "#0891b2",
        fontWeight: 700,
        textDecoration: "none",
      },
      subtitle: {
        color: isDark ? "#94a3b8" : "#475569",
      },
    }),
    [isDark],
  );

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.topRow}>
          <a href="/" style={styles.link}>← Volver al índice</a>
          <div style={styles.switch} role="group" aria-label="Selector de tema">
            <button
              type="button"
              onClick={() => setThemeChoice("light")}
              aria-label="Tema claro"
              aria-pressed={activeTheme === "light"}
              style={styles.chip(activeTheme === "light")}
            >
              <SunIcon />
            </button>
            <button
              type="button"
              onClick={() => setThemeChoice("dark")}
              aria-label="Tema oscuro"
              aria-pressed={activeTheme === "dark"}
              style={styles.chip(activeTheme === "dark")}
            >
              <MoonIcon />
            </button>
          </div>
        </div>
        <h1 style={{ marginTop: 0 }}>Herramienta ejemplo</h1>
        <p style={styles.subtitle}>Plantilla mínima para nuevas apps con Vite + React + TypeScript.</p>
        <p style={styles.subtitle}>El tema claro/oscuro se guarda y se comparte con el resto de apps.</p>
      </div>
    </div>
  );
}

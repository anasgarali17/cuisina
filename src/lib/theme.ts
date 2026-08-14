/**
 * Thèmes de l'interface. "light" est le :root nu ; tout autre thème pose sa
 * classe sur <html> (voir globals.css). Pour en ajouter un : une entrée ici,
 * un bloc de variables CSS, une étiquette dans parametres.themes.*.
 */
export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = "cuisina-theme";

/** Pastilles d'aperçu sur la page Paramètres — miroir des tokens de globals.css. */
export const THEME_PREVIEWS: Record<
  Theme,
  { fond: string; carte: string; accent: string }
> = {
  light: {
    fond: "hsl(40 44% 98%)",
    carte: "hsl(0 0% 100%)",
    accent: "hsl(356 83% 41%)",
  },
  dark: {
    fond: "hsl(240 10% 3.9%)",
    carte: "hsl(240 10% 5.5%)",
    accent: "hsl(0 0% 98%)",
  },
};

/** Same-tab notifications so every theme picker re-renders on applyTheme. */
const listeners = new Set<() => void>();

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if ((THEMES as readonly string[]).includes(stored ?? "")) {
      return stored as Theme;
    }
  } catch {
    // Preference only — safe to lose in private browsing.
  }
  return "light";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  for (const t of THEMES) {
    if (t !== "light") root.classList.toggle(t, t === theme);
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Preference only — safe to lose in private browsing.
  }
  for (const listener of listeners) listener();
}

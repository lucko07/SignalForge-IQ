export const THEME_STORAGE_KEY = "sfiq-theme";

export type Theme = "light" | "dark";

export const isTheme = (value: string | null): value is Theme =>
  value === "light" || value === "dark";

export const getStoredTheme = (): Theme | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(storedTheme) ? storedTheme : null;
};

export const getSystemTheme = (): Theme => {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
};

export const getResolvedTheme = (): Theme => getStoredTheme() ?? getSystemTheme();

export const applyTheme = (theme: Theme) => {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
};

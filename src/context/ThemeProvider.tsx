import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  getResolvedTheme,
  getStoredTheme,
  getSystemTheme,
  type Theme,
} from "../lib/theme";

type ThemeContextValue = {
  theme: Theme;
  setThemePreference: (theme: Theme) => void;
  clearThemePreference: () => void;
  toggleTheme: () => void;
  usingSystemTheme: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const getInitialTheme = (): Theme => {
  if (typeof document !== "undefined") {
    const documentTheme = document.documentElement.dataset.theme;
    if (documentTheme === "light" || documentTheme === "dark") {
      return documentTheme;
    }
  }

  return getResolvedTheme();
};

function ThemeProvider({ children }: PropsWithChildren) {
  const [savedTheme, setSavedTheme] = useState<Theme | null>(() => getStoredTheme());
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (savedTheme) {
      window.localStorage.setItem(THEME_STORAGE_KEY, savedTheme);
      return;
    }

    window.localStorage.removeItem(THEME_STORAGE_KEY);
  }, [savedTheme]);

  useEffect(() => {
    if (savedTheme || typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setTheme(getSystemTheme());
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [savedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setThemePreference: (nextTheme) => {
        setSavedTheme(nextTheme);
        setTheme(nextTheme);
      },
      clearThemePreference: () => {
        const systemTheme = getSystemTheme();
        setSavedTheme(null);
        setTheme(systemTheme);
      },
      toggleTheme: () => {
        const nextTheme: Theme = theme === "dark" ? "light" : "dark";
        setSavedTheme(nextTheme);
        setTheme(nextTheme);
      },
      usingSystemTheme: savedTheme === null,
    }),
    [savedTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
};

export default ThemeProvider;

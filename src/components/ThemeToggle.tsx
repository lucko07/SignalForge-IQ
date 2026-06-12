import { useTheme } from "../context/ThemeProvider";

function ThemeToggle() {
  const { theme, toggleTheme, usingSystemTheme, clearThemePreference } = useTheme();

  return (
    <div style={containerStyle}>
      <button
        type="button"
        onClick={toggleTheme}
        style={toggleButtonStyle}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
      {usingSystemTheme ? (
        <span style={statusStyle}>System</span>
      ) : (
        <button type="button" onClick={clearThemePreference} style={resetButtonStyle}>
          Use system
        </button>
      )}
    </div>
  );
}

const containerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
  flexWrap: "wrap" as const,
};

const toggleButtonStyle = {
  border: "1px solid var(--color-border)",
  borderRadius: "999px",
  padding: "0.55rem 0.9rem",
  backgroundColor: "var(--color-surface)",
  color: "var(--color-text-primary)",
  fontSize: "0.92rem",
  fontWeight: 600,
  cursor: "pointer",
};

const resetButtonStyle = {
  border: "none",
  padding: "0.1rem 0.25rem",
  backgroundColor: "transparent",
  color: "var(--color-text-muted)",
  fontSize: "0.82rem",
  fontWeight: 600,
  cursor: "pointer",
};

const statusStyle = {
  color: "var(--color-text-subtle)",
  fontSize: "0.8rem",
  fontWeight: 600,
};

export default ThemeToggle;

import type { ChangeEvent } from "react";
import { useLocation } from "react-router-dom";

const languages = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
] as const;

const hiddenPrefixes = ["/dashboard", "/admin"];

function TranslateControl() {
  const location = useLocation();

  if (hiddenPrefixes.some((prefix) => location.pathname.startsWith(prefix))) {
    return null;
  }

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLanguage = event.target.value;

    if (nextLanguage === "en") {
      return;
    }

    const currentUrl = window.location.href;
    const translatedUrl = `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(nextLanguage)}&u=${encodeURIComponent(currentUrl)}`;
    window.location.assign(translatedUrl);
  };

  return (
    <label style={controlStyle}>
      <span style={labelTextStyle}>Translate</span>
      <div style={selectWrapStyle}>
        <select defaultValue="en" onChange={handleChange} style={selectStyle} aria-label="Select language">
          {languages.map((language) => (
            <option key={language.code} value={language.code}>
              {language.label}
            </option>
          ))}
        </select>
        <span aria-hidden="true" style={chevronStyle}>
          ▾
        </span>
      </div>
    </label>
  );
}

const controlStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
  padding: "0.55rem 0.9rem",
  borderRadius: "999px",
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-surface)",
  color: "var(--color-button-secondary-text)",
  fontSize: "0.92rem",
  fontWeight: 600,
  flexWrap: "wrap" as const,
};

const labelTextStyle = {
  whiteSpace: "nowrap" as const,
  color: "var(--color-text-muted)",
};

const selectWrapStyle = {
  position: "relative" as const,
  display: "flex",
  alignItems: "center",
};

const selectStyle = {
  border: "none",
  padding: "0 1rem 0 0",
  backgroundColor: "transparent",
  color: "var(--color-text-primary)",
  fontSize: "0.9rem",
  fontWeight: 600,
  cursor: "pointer",
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
  MozAppearance: "none" as const,
  outline: "none",
  minWidth: "4.5rem",
};

const chevronStyle = {
  position: "absolute" as const,
  right: 0,
  color: "var(--color-text-subtle)",
  fontSize: "0.8rem",
  pointerEvents: "none" as const,
};

export default TranslateControl;

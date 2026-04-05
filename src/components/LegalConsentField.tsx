import { Link } from "react-router-dom";

type LegalConsentFieldProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
};

function LegalConsentField({ checked, onChange, error = "" }: LegalConsentFieldProps) {
  return (
    <div style={{ display: "grid", gap: "0.55rem" }}>
      <label style={labelStyle}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          style={checkboxStyle}
        />
        <span style={{ color: "#344054", lineHeight: 1.6 }}>
          I agree to the{" "}
          <Link to="/terms" style={linkStyle}>
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" style={linkStyle}>
            Privacy Policy
          </Link>
        </span>
      </label>
      {error ? <p style={errorStyle}>{error}</p> : null}
    </div>
  );
}

const labelStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.75rem",
};

const checkboxStyle = {
  marginTop: "0.2rem",
  width: "1rem",
  height: "1rem",
  flexShrink: 0,
};

const linkStyle = {
  color: "#101828",
  fontWeight: 700,
};

const errorStyle = {
  margin: 0,
  color: "#b42318",
  fontSize: "0.95rem",
};

export default LegalConsentField;

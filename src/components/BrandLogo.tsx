import { Link } from "react-router-dom";

type BrandLogoProps = {
  variant?: "compact" | "footer" | "full";
};

const fullLogoSrc = "/branding/signalforgeiq-logo.png";
const markLogoSrc = "/branding/signalforgeiq-mark.png";

function BrandLogo({ variant = "compact" }: BrandLogoProps) {
  if (variant === "full") {
    return (
      <Link
        to="/"
        aria-label="SignalForge IQ home"
        style={fullLinkStyle}
      >
        <img
          src={fullLogoSrc}
          alt="SignalForge IQ logo"
          style={fullImageStyle}
        />
      </Link>
    );
  }

  const isFooter = variant === "footer";

  return (
    <Link
      to="/"
      aria-label="SignalForge IQ home"
      style={isFooter ? footerLinkStyle : compactLinkStyle}
    >
      <span style={isFooter ? footerMarkWrapStyle : compactMarkWrapStyle}>
        <img
          src={markLogoSrc}
          alt="SignalForge IQ logo mark"
          style={isFooter ? footerMarkImageStyle : compactMarkImageStyle}
        />
      </span>
      <span style={isFooter ? footerWordmarkStyle : compactWordmarkStyle}>
        <span style={brandNameStyle}>SignalForge</span>
        <span style={brandIqStyle(isFooter)}> IQ</span>
      </span>
    </Link>
  );
}

const sharedLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
};

const fullLinkStyle = {
  ...sharedLinkStyle,
};

const compactLinkStyle = {
  ...sharedLinkStyle,
  gap: "0.7rem",
};

const footerLinkStyle = {
  ...sharedLinkStyle,
  gap: "0.55rem",
};

const sharedMarkWrapStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const compactMarkWrapStyle = {
  ...sharedMarkWrapStyle,
  minHeight: "36px",
};

const footerMarkWrapStyle = {
  ...sharedMarkWrapStyle,
  minHeight: "28px",
};

const sharedMarkImageStyle = {
  display: "block",
  width: "auto",
  objectFit: "contain" as const,
  flexShrink: 0,
};

const compactMarkImageStyle = {
  ...sharedMarkImageStyle,
  height: "34px",
  maxHeight: "34px",
};

const footerMarkImageStyle = {
  ...sharedMarkImageStyle,
  height: "28px",
  maxHeight: "28px",
};

const compactWordmarkStyle = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: "1.08rem",
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: "0.02em",
  color: "var(--color-text-primary)",
};

const footerWordmarkStyle = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: "0.96rem",
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: "0.02em",
  color: "var(--color-text-primary)",
};

const brandNameStyle = {
  color: "var(--color-text-primary)",
};

const brandIqStyle = (isFooter: boolean) => ({
  color: isFooter ? "#55d800" : "#5ce10e",
});

const fullImageStyle = {
  display: "block",
  width: "auto",
  height: "clamp(64px, 9vw, 92px)",
  maxWidth: "100%",
  objectFit: "contain" as const,
};

export default BrandLogo;

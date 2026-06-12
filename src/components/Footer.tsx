import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import TradingDisclaimer from "./TradingDisclaimer";

const footerLinks = [
  { label: "Pricing", to: "/pricing" },
  { label: "Signals", to: "/signals" },
  { label: "Contact", to: "/contact" },
  { label: "Terms of Service", to: "/terms" },
  { label: "Privacy Policy", to: "/privacy" },
] as const;

function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--color-border)",
        marginTop: "2rem",
        backgroundColor: "var(--color-surface-alt)",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "1.25rem 2rem",
          display: "grid",
          gap: "1rem",
          color: "var(--color-text-muted)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={footerBrandStyle}>
            <BrandLogo variant="footer" />
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <p style={{ margin: 0 }}>Market education, signals, and account access.</p>
            <nav aria-label="Footer" style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap" }}>
              {footerLinks.map((link) => (
                <Link key={link.to} to={link.to} style={footerLinkStyle}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <TradingDisclaimer compact />
      </div>
    </footer>
  );
}

const footerLinkStyle = {
  color: "var(--color-text-muted)",
  textDecoration: "none",
  fontWeight: 600,
};

const footerBrandStyle = {
  display: "flex",
  alignItems: "center",
  minHeight: "32px",
};

export default Footer;

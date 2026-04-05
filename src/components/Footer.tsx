import { Link } from "react-router-dom";
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
        borderTop: "1px solid #d6d9e0",
        marginTop: "2rem",
        backgroundColor: "#f8fafc",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "1.25rem 2rem",
          display: "grid",
          gap: "1rem",
          color: "#475467",
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
          <p style={{ margin: 0, fontWeight: 600 }}>SignalForge IQ</p>
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
  color: "#475467",
  textDecoration: "none",
  fontWeight: 600,
};

export default Footer;

import { Link } from "react-router-dom";
import TradingDisclaimer from "../components/TradingDisclaimer";

const processSteps = [
  {
    title: "Directional market phase",
    description:
      "The BTC Continuation Engine focuses on directional market phases where continuation structure is clearer and setup quality can stay disciplined.",
  },
  {
    title: "Structured 30m pullback",
    description:
      "The product is designed around 30-minute continuation pullbacks rather than constant activity, helping members focus on cleaner market structure.",
  },
  {
    title: "Clear trade levels",
    description:
      "When a qualified setup appears, members receive a structured view with entry, risk, and target levels that support disciplined execution.",
  },
  {
    title: "Real-time delivery",
    description:
      "SignalForge IQ delivers the setup in real time for members who want a cleaner operating flow around structured Bitcoin alerts.",
  },
] as const;

function HowItWorksPage() {
  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <div style={heroCopyStyle}>
          <p style={eyebrowStyle}>How It Works</p>
          <h1 style={heroTitleStyle}>BTC Continuation Engine</h1>
          <p style={heroSubtitleStyle}>BTC-focused continuation strategy for structured 30-minute setups.</p>
          <p style={heroBodyStyle}>
            SignalForge IQ&apos;s BTC Continuation Engine is designed to identify structured Bitcoin continuation setups
            during directional market phases, with clear entry, risk, and target levels for disciplined execution.
          </p>
          <div style={heroActionsStyle}>
            <Link to="/signals" style={primaryLinkStyle}>
              View strategy
            </Link>
            <Link to="/pricing" style={secondaryLinkStyle}>
              Get access
            </Link>
          </div>
        </div>

        <div style={heroPanelStyle}>
          <strong style={panelTitleStyle}>Built for disciplined continuation setups</strong>
          <p style={panelBodyStyle}>
            This product is positioned for traders who want structured alerts, clearer continuation opportunities,
            and a more disciplined 30-minute workflow around BTC.
          </p>
        </div>
      </div>

      <div style={sectionCardStyle}>
        <div style={sectionHeaderStyle}>
          <p style={sectionEyebrowStyle}>Product structure</p>
          <h2 style={sectionTitleStyle}>What the BTC Continuation Engine is built to do</h2>
          <p style={sectionBodyStyle}>
            The product stays focused on Bitcoin and is not presented as a universal engine for every crypto asset.
            It is designed to support cleaner continuation participation during directional market phases. Backtested on BTCUSD 30m.
          </p>
        </div>

        <div style={stepGridStyle}>
          {processSteps.map((step) => (
            <article key={step.title} style={stepCardStyle}>
              <strong style={stepTitleStyle}>{step.title}</strong>
              <p style={stepBodyStyle}>{step.description}</p>
            </article>
          ))}
        </div>
      </div>

      <div style={sectionCardStyle}>
        <div style={sectionHeaderStyle}>
          <p style={sectionEyebrowStyle}>Member fit</p>
          <h2 style={sectionTitleStyle}>Who this product is for</h2>
          <p style={sectionBodyStyle}>
            BTC Continuation Engine is suited to traders who want structured alerts, disciplined setups, and a premium
            SignalForge IQ workflow rather than noisy, always-on signal volume.
          </p>
        </div>

        <div style={memberGridStyle}>
          <div style={memberCardStyle}>
            <strong style={stepTitleStyle}>BTC-focused</strong>
            <p style={stepBodyStyle}>Built around Bitcoin market structure on the 30-minute timeframe.</p>
          </div>
          <div style={memberCardStyle}>
            <strong style={stepTitleStyle}>Structured execution</strong>
            <p style={stepBodyStyle}>Delivers clear trade levels for traders who want more discipline around entries and risk.</p>
          </div>
          <div style={memberCardStyle}>
            <strong style={stepTitleStyle}>SignalForge IQ delivery</strong>
            <p style={stepBodyStyle}>Fits into the existing member experience with real-time product delivery and clear upgrade paths.</p>
          </div>
        </div>
      </div>

      <div style={ctaCardStyle}>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <p style={sectionEyebrowStyle}>Access</p>
          <h2 style={ctaTitleStyle}>See the BTC strategy inside the member workflow</h2>
          <p style={sectionBodyStyle}>
            Explore the public signals page for a preview, or compare plans to see where BTC Continuation Engine fits
            into the broader SignalForge IQ product lineup. Backtested performance is not a guarantee of future results.
          </p>
        </div>
        <div style={heroActionsStyle}>
          <Link to="/signals" style={primaryLinkStyle}>
            View strategy
          </Link>
          <Link to="/pricing" style={secondaryDarkLinkStyle}>
            Upgrade for access
          </Link>
        </div>
      </div>

      <TradingDisclaimer compact />
    </section>
  );
}

const pageStyle = {
  display: "grid",
  gap: "1.5rem",
  padding: "2rem 0",
};

const heroStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1.25rem",
  padding: "2rem",
  borderRadius: "24px",
  border: "1px solid var(--color-hero-border)",
  background:
    "radial-gradient(circle at top left, rgba(184, 214, 247, 0.22), transparent 28%), linear-gradient(135deg, #0f172a 0%, #172033 52%, #213753 100%)",
};

const heroCopyStyle = {
  display: "grid",
  gap: "0.8rem",
  alignContent: "center",
};

const eyebrowStyle = {
  margin: 0,
  color: "#d0d5dd",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  fontSize: "0.82rem",
};

const heroTitleStyle = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "clamp(2.2rem, 4vw, 3.4rem)",
  lineHeight: 1.05,
};

const heroSubtitleStyle = {
  margin: 0,
  color: "#b8d6f1",
  fontWeight: 700,
};

const heroBodyStyle = {
  margin: 0,
  color: "#d9e3ef",
  lineHeight: 1.75,
  maxWidth: "62ch",
};

const heroPanelStyle = {
  display: "grid",
  gap: "0.45rem",
  padding: "1.15rem",
  borderRadius: "18px",
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "rgba(255,255,255,0.05)",
  alignContent: "start",
};

const panelTitleStyle = {
  color: "#ffffff",
};

const panelBodyStyle = {
  margin: 0,
  color: "#d0d5dd",
  lineHeight: 1.65,
};

const heroActionsStyle = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap" as const,
};

const primaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  padding: "0.9rem 1.15rem",
  borderRadius: "12px",
  backgroundColor: "#ffffff",
  color: "#101828",
  fontWeight: 700,
};

const secondaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  padding: "0.9rem 1.15rem",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.18)",
  backgroundColor: "rgba(255,255,255,0.08)",
  color: "#ffffff",
  fontWeight: 700,
};

const secondaryDarkLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  padding: "0.9rem 1.15rem",
  borderRadius: "12px",
  border: "1px solid var(--color-border-strong)",
  backgroundColor: "var(--color-surface)",
  color: "var(--color-text-primary)",
  fontWeight: 700,
};

const sectionCardStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.5rem",
  borderRadius: "24px",
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-surface)",
};

const sectionHeaderStyle = {
  display: "grid",
  gap: "0.35rem",
};

const sectionEyebrowStyle = {
  margin: 0,
  color: "var(--color-text-muted)",
  fontWeight: 700,
  fontSize: "0.8rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
};

const sectionTitleStyle = {
  margin: 0,
  color: "var(--color-text-primary)",
  fontSize: "1.7rem",
};

const sectionBodyStyle = {
  margin: 0,
  color: "var(--color-text-muted)",
  lineHeight: 1.7,
  maxWidth: "72ch",
};

const stepGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "0.9rem",
};

const stepCardStyle = {
  display: "grid",
  gap: "0.45rem",
  padding: "1rem",
  borderRadius: "16px",
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-surface-alt)",
};

const stepTitleStyle = {
  color: "var(--color-text-primary)",
};

const stepBodyStyle = {
  margin: 0,
  color: "var(--color-text-muted)",
  lineHeight: 1.65,
};

const memberGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "0.9rem",
};

const memberCardStyle = {
  display: "grid",
  gap: "0.45rem",
  padding: "1rem",
  borderRadius: "16px",
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-surface-alt)",
};

const ctaCardStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.5rem",
  borderRadius: "24px",
  border: "1px solid var(--color-border)",
  background: "linear-gradient(135deg, var(--color-surface-muted) 0%, var(--color-surface) 100%)",
};

const ctaTitleStyle = {
  margin: 0,
  color: "var(--color-text-primary)",
};

export default HowItWorksPage;

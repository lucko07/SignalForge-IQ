import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import TradingDisclaimer from "../components/TradingDisclaimer";

function HomePage() {
  return (
    <section style={pageStyle}>
      <Helmet>
        <title>SignalForge IQ | Trading Signals with Automated Performance Tracking</title>
        <meta
          name="description"
          content="SignalForge IQ delivers high-quality trading signals with automated tracking, analytics, and performance insights for serious traders."
        />
      </Helmet>
      <div style={heroStyle}>
        <div style={heroCopyStyle}>
          <p style={eyebrowStyle}>Featured Strategy</p>
          <h1 style={heroTitleStyle}>SignalForge IQ BTC Continuation Engine</h1>
          <p style={heroSubtitleStyle}>BTC-focused continuation strategy for structured 30-minute setups.</p>
          <p style={heroBodyStyle}>
            SignalForge IQ&apos;s BTC Continuation Engine is designed to identify structured Bitcoin continuation setups
            during directional market phases, with clear entry, risk, and target levels for disciplined execution.
          </p>
          <p style={heroSupportStyle}>
            Backtested on BTCUSD 30m, this production candidate focuses on BTC continuation structure rather than broad,
            one-size-fits-all crypto coverage. Backtested performance is not a guarantee of future results.
          </p>
          <div style={heroActionsStyle}>
            <Link to="/how-it-works" style={primaryLinkStyle}>
              See how it works
            </Link>
            <Link to="/pricing" style={secondaryLinkStyle}>
              Upgrade for access
            </Link>
          </div>
        </div>

        <div style={heroPanelStyle}>
          <div style={heroPanelCardStyle}>
            <span style={panelLabelStyle}>BTC Continuation Engine</span>
            <strong style={panelTitleStyle}>Built for cleaner 30m continuation structure</strong>
            <p style={panelBodyStyle}>
              Designed to identify structured BTC continuation setups with clear entry, risk, and target levels for
              disciplined execution.
            </p>
          </div>

          <div style={featureGridStyle}>
            <div style={featureCardStyle}>
              <strong style={featureTitleStyle}>BTC-focused</strong>
              <p style={featureBodyStyle}>Focused on Bitcoin continuation behavior rather than broad, generalized crypto coverage.</p>
            </div>
            <div style={featureCardStyle}>
              <strong style={featureTitleStyle}>30m continuation structure</strong>
              <p style={featureBodyStyle}>Built for cleaner trend-following entries during directional market phases.</p>
            </div>
            <div style={featureCardStyle}>
              <strong style={featureTitleStyle}>Real-time delivery</strong>
              <p style={featureBodyStyle}>Supports SignalForge IQ members with structured alerts when qualified setups appear.</p>
            </div>
          </div>
        </div>
      </div>

      <div style={lineupGridStyle}>
        <article style={lineupCardStyle}>
          <p style={cardEyebrowStyle}>Product lineup</p>
          <h2 style={cardTitleStyle}>BTC Continuation Engine</h2>
          <p style={cardBodyStyle}>
            A BTC-focused continuation strategy for structured 30-minute setups, with clear levels and real-time
            member delivery.
          </p>
          <ul style={bulletListStyle}>
            <li>BTC-focused continuation strategy</li>
            <li>Built around 30-minute market structure</li>
            <li>DD-control risk framework</li>
            <li>Clear entry, risk, and target levels</li>
            <li>Built for SignalForge IQ members</li>
          </ul>
          <Link to="/signals" style={inlineLinkStyle}>
            View strategy
          </Link>
        </article>

        <article style={lineupCardStyle}>
          <p style={cardEyebrowStyle}>Membership fit</p>
          <h2 style={cardTitleStyle}>Structured alerts inside the existing SignalForge IQ workflow</h2>
          <p style={cardBodyStyle}>
            The BTC Continuation Engine fits into the same premium member experience as the rest of the platform, with
            disciplined setup monitoring, real-time delivery, and clear upgrade paths through Pro and Elite.
          </p>
          <div style={linkRowStyle}>
            <Link to="/pricing" style={inlineLinkStyle}>
              Get access
            </Link>
            <Link to="/dashboard" style={inlineMutedLinkStyle}>
              Member workspace
            </Link>
          </div>
        </article>
      </div>

      <div style={guideSectionStyle}>
        <div style={guideHeadingStyle}>
          <p style={cardEyebrowStyle}>Trading Guides</p>
          <h2 style={guideTitleStyle}>Explore the ideas behind disciplined signal workflows</h2>
          <p style={guideBodyStyle}>
            SignalForge IQ now includes public landing pages focused on signal quality, crypto market structure, and
            performance review for traders who want a more grounded framework.
          </p>
        </div>

        <div style={lineupGridStyle}>
          <article style={lineupCardStyle}>
            <p style={cardEyebrowStyle}>Signal quality</p>
            <h3 style={cardTitleStyle}>Best Trading Signals</h3>
            <p style={cardBodyStyle}>
              Learn what separates structured trading signals from low-quality alert streams and why review matters.
            </p>
            <Link to="/best-trading-signals" style={inlineLinkStyle}>
              Read the guide
            </Link>
          </article>

          <article style={lineupCardStyle}>
            <p style={cardEyebrowStyle}>Crypto structure</p>
            <h3 style={cardTitleStyle}>Crypto Trading Signals</h3>
            <p style={cardBodyStyle}>
              See how SignalForge IQ approaches BTC-focused crypto signals with risk structure and performance tracking.
            </p>
            <Link to="/crypto-trading-signals" style={inlineLinkStyle}>
              Explore crypto signals
            </Link>
          </article>

          <article style={lineupCardStyle}>
            <p style={cardEyebrowStyle}>Performance review</p>
            <h3 style={cardTitleStyle}>Track Trading Performance</h3>
            <p style={cardBodyStyle}>
              Review the metrics and analytics mindset that help traders connect alerts to outcomes over time.
            </p>
            <Link to="/track-trading-performance" style={inlineLinkStyle}>
              Learn performance tracking
            </Link>
          </article>
        </div>
      </div>

      <TradingDisclaimer compact />
    </section>
  );
}

const pageStyle = {
  padding: "3rem 0",
  display: "grid",
  gap: "1.5rem",
};

const heroStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1.25rem",
  padding: "2rem",
  border: "1px solid var(--color-hero-border)",
  borderRadius: "28px",
  background:
    "radial-gradient(circle at top left, rgba(190, 214, 241, 0.22), transparent 32%), linear-gradient(135deg, #0f172a 0%, #172033 56%, #213753 100%)",
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
  fontSize: "0.85rem",
};

const heroTitleStyle = {
  margin: 0,
  fontSize: "clamp(2.4rem, 4vw, 3.8rem)",
  color: "#f8fafc",
  lineHeight: 1.04,
};

const heroSubtitleStyle = {
  margin: 0,
  color: "#b8d6f1",
  fontWeight: 700,
  fontSize: "1rem",
};

const heroBodyStyle = {
  margin: 0,
  fontSize: "1.05rem",
  color: "#e2e8f0",
  lineHeight: 1.75,
  maxWidth: "64ch",
};

const heroSupportStyle = {
  margin: 0,
  color: "#cbd5e1",
  lineHeight: 1.7,
  maxWidth: "62ch",
};

const heroActionsStyle = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap" as const,
  marginTop: "0.25rem",
};

const primaryLinkStyle = {
  textDecoration: "none",
  backgroundColor: "#ffffff",
  color: "#101828",
  padding: "0.9rem 1.2rem",
  borderRadius: "12px",
  fontWeight: 700,
};

const secondaryLinkStyle = {
  textDecoration: "none",
  backgroundColor: "rgba(255,255,255,0.08)",
  color: "#f8fafc",
  padding: "0.9rem 1.2rem",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.18)",
  fontWeight: 700,
};

const heroPanelStyle = {
  display: "grid",
  gap: "1rem",
};

const heroPanelCardStyle = {
  display: "grid",
  gap: "0.45rem",
  padding: "1.1rem",
  borderRadius: "18px",
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "rgba(255,255,255,0.05)",
};

const panelLabelStyle = {
  color: "#b8d6f1",
  fontWeight: 700,
  fontSize: "0.8rem",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
};

const panelTitleStyle = {
  color: "#ffffff",
  fontSize: "1.05rem",
};

const panelBodyStyle = {
  margin: 0,
  color: "#d0d5dd",
  lineHeight: 1.65,
};

const featureGridStyle = {
  display: "grid",
  gap: "0.8rem",
};

const featureCardStyle = {
  display: "grid",
  gap: "0.35rem",
  padding: "1rem",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "rgba(255,255,255,0.04)",
};

const featureTitleStyle = {
  color: "#f8fafc",
};

const featureBodyStyle = {
  margin: 0,
  color: "#d0d5dd",
  lineHeight: 1.6,
};

const lineupGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1rem",
};

const guideSectionStyle = {
  display: "grid",
  gap: "1rem",
};

const guideHeadingStyle = {
  display: "grid",
  gap: "0.45rem",
};

const guideTitleStyle = {
  margin: 0,
  color: "var(--color-text-primary)",
  fontSize: "2rem",
};

const guideBodyStyle = {
  margin: 0,
  color: "var(--color-text-muted)",
  lineHeight: 1.7,
  maxWidth: "68ch",
};

const lineupCardStyle = {
  display: "grid",
  gap: "0.7rem",
  padding: "1.5rem",
  border: "1px solid var(--color-border)",
  borderRadius: "24px",
  backgroundColor: "var(--color-surface-alt)",
};

const cardEyebrowStyle = {
  margin: 0,
  color: "var(--color-text-muted)",
  fontWeight: 700,
  fontSize: "0.8rem",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

const cardTitleStyle = {
  margin: 0,
  color: "var(--color-text-primary)",
  fontSize: "1.5rem",
};

const cardBodyStyle = {
  margin: 0,
  color: "var(--color-text-muted)",
  lineHeight: 1.7,
};

const bulletListStyle = {
  margin: 0,
  paddingLeft: "1.1rem",
  color: "var(--color-button-secondary-text)",
  lineHeight: 1.7,
};

const linkRowStyle = {
  display: "flex",
  gap: "1rem",
  flexWrap: "wrap" as const,
  alignItems: "center",
};

const inlineLinkStyle = {
  textDecoration: "none",
  color: "var(--color-info-text)",
  fontWeight: 700,
};

const inlineMutedLinkStyle = {
  textDecoration: "none",
  color: "var(--color-text-muted)",
  fontWeight: 700,
};

export default HomePage;

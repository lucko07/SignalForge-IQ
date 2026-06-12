import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import TradingDisclaimer from "../components/TradingDisclaimer";

const cryptoChallenges = [
  {
    title: "24/7 market pace",
    body:
      "Crypto does not pause for a market close. Traders need a process that can handle constant opportunity without encouraging constant action.",
  },
  {
    title: "Volatility without structure",
    body:
      "Fast movement can look attractive, but without defined entries and invalidation levels it becomes difficult to separate quality from noise.",
  },
  {
    title: "Execution discipline",
    body:
      "The real edge often comes from waiting for aligned conditions, not reacting to every move across every coin.",
  },
] as const;

const btcMarketPoints = [
  "BTC remains one of the most liquid crypto markets, which can support cleaner execution when structure appears.",
  "A BTC-focused process can help traders avoid scattering attention across dozens of lower-quality setups.",
  "Because the market runs continuously, a disciplined system matters even more than raw signal frequency.",
] as const;

const riskPrinciples = [
  "A crypto signal should define the idea before price moves, not after the opportunity is gone.",
  "Risk should be measured from the invalidation point, not from emotion or hope.",
  "Position sizing matters more in volatile conditions because a good setup can still fail.",
  "Execution discipline includes knowing when not to trade if confirmation never arrives.",
] as const;

const trackingSteps = [
  {
    title: "Signal issued with structure",
    body:
      "SignalForge IQ frames entries with direction, trade levels, and context so the setup can be evaluated before action.",
  },
  {
    title: "Lifecycle status stays visible",
    body:
      "Signals move through a clear progression so traders can see whether a setup is pending, active, or already resolved.",
  },
  {
    title: "Outcome review supports accountability",
    body:
      "When signals are logged and reviewed, traders can study whether the process is producing disciplined execution over time.",
  },
  {
    title: "Analytics turn alerts into learning",
    body:
      "The goal is not only to receive alerts, but to connect those alerts to outcomes, decision quality, and future improvement.",
  },
] as const;

function CryptoTradingSignalsPage() {
  return (
    <section style={pageStyle}>
      <Helmet>
        <title>Crypto Trading Signals | BTC Signal Tracking | SignalForge IQ</title>
        <meta
          name="description"
          content="Explore crypto trading signals with structured entries, risk management, and automated tracking designed for traders who want more than alerts alone."
        />
      </Helmet>

      <div style={heroStyle}>
        <div style={heroCopyStyle}>
          <p style={eyebrowStyle}>Crypto Signals</p>
          <h1 style={heroTitleStyle}>Crypto Trading Signals with Performance Tracking</h1>
          <p style={heroBodyStyle}>
            Crypto markets reward preparation more than impulse. Strong signals need structure, disciplined execution,
            and a way to review what happened after the alert is sent.
          </p>
          <p style={heroSupportStyle}>
            SignalForge IQ approaches crypto trading as a serious process: defined entries, risk-aware execution, and
            outcome tracking built to support better decisions over time.
          </p>
          <div style={heroActionsStyle}>
            <Link to="/signals" style={primaryLinkStyle}>
              View signals
            </Link>
            <Link to="/education" style={secondaryLinkStyle}>
              Learn the framework
            </Link>
            <Link to="/pricing" style={heroTextLinkStyle}>
              Compare membership
            </Link>
          </div>
        </div>

        <div style={heroPanelStyle}>
          <div style={heroPanelCardStyle}>
            <span style={heroPanelLabelStyle}>Built for disciplined crypto workflows</span>
            <strong style={heroPanelTitleStyle}>BTC opportunity matters, but process matters more.</strong>
            <p style={heroPanelBodyStyle}>
              Traders need more than alerts alone in a 24/7 market. They need structure, selectivity, and a clear way
              to connect the signal idea to the eventual outcome.
            </p>
          </div>

          <div style={heroMetricGridStyle}>
            <div style={heroMetricCardStyle}>
              <strong style={heroMetricTitleStyle}>BTC-focused</strong>
              <p style={heroMetricBodyStyle}>Cleaner market coverage instead of scattered alert volume.</p>
            </div>
            <div style={heroMetricCardStyle}>
              <strong style={heroMetricTitleStyle}>Risk-defined</strong>
              <p style={heroMetricBodyStyle}>Signals are more useful when invalidation is as clear as the entry.</p>
            </div>
            <div style={heroMetricCardStyle}>
              <strong style={heroMetricTitleStyle}>Reviewable</strong>
              <p style={heroMetricBodyStyle}>Outcome tracking helps traders evaluate process quality over time.</p>
            </div>
          </div>
        </div>
      </div>

      <article style={sectionCardStyle}>
        <div style={sectionHeadingStyle}>
          <p style={sectionEyebrowStyle}>Market Reality</p>
          <h2 style={sectionTitleStyle}>Why crypto requires a disciplined system</h2>
          <p style={sectionBodyStyle}>
            The speed and accessibility of crypto can create the illusion that every move deserves attention. In
            practice, strong results usually come from selectivity, patience, and well-defined risk.
          </p>
        </div>

        <div style={cardsGridStyle}>
          {cryptoChallenges.map((item) => (
            <article key={item.title} style={infoCardStyle}>
              <h3 style={cardTitleStyle}>{item.title}</h3>
              <p style={cardBodyStyle}>{item.body}</p>
            </article>
          ))}
        </div>
      </article>

      <div style={splitGridStyle}>
        <article style={sectionCardStyle}>
          <div style={sectionHeadingStyle}>
            <p style={sectionEyebrowStyle}>BTC Focus</p>
            <h2 style={sectionTitleStyle}>BTC-focused opportunity and 24/7 markets</h2>
            <p style={sectionBodyStyle}>
              Bitcoin often provides a cleaner operating context for crypto traders because liquidity, market attention,
              and trend structure can be easier to assess than in thinner, noisier markets.
            </p>
          </div>

          <div style={bulletListStyle}>
            {btcMarketPoints.map((item) => (
              <div key={item} style={bulletRowStyle}>
                <span aria-hidden="true" style={bulletMarkStyle}>
                  +
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </article>

        <article style={sectionCardStyle}>
          <div style={sectionHeadingStyle}>
            <p style={sectionEyebrowStyle}>Execution Discipline</p>
            <h2 style={sectionTitleStyle}>Risk management and execution discipline</h2>
            <p style={sectionBodyStyle}>
              A crypto signal is only useful if it supports calm execution. That means respecting invalidation,
              sizing appropriately, and avoiding the urge to chase every move that looks exciting.
            </p>
          </div>

          <div style={bulletListStyle}>
            {riskPrinciples.map((item) => (
              <div key={item} style={bulletRowStyle}>
                <span aria-hidden="true" style={bulletMarkStyle}>
                  +
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article style={sectionCardStyle}>
        <div style={sectionHeadingStyle}>
          <p style={sectionEyebrowStyle}>Review Layer</p>
          <h2 style={sectionTitleStyle}>How SignalForge IQ tracks signal outcomes</h2>
          <p style={sectionBodyStyle}>
            Alerts alone are incomplete. SignalForge IQ is built around the idea that traders benefit when the signal
            process can be reviewed with context, outcomes, and disciplined follow-through.
          </p>
        </div>

        <div style={cardsGridStyle}>
          {trackingSteps.map((item) => (
            <article key={item.title} style={infoCardStyle}>
              <h3 style={cardTitleStyle}>{item.title}</h3>
              <p style={cardBodyStyle}>{item.body}</p>
            </article>
          ))}
        </div>

        <div style={inlineLinkRowStyle}>
          <Link to="/track-trading-performance" style={inlineLinkStyle}>
            Read more about performance tracking
          </Link>
          <Link to="/education" style={inlineMutedLinkStyle}>
            Review the education hub
          </Link>
        </div>
      </article>

      <div style={ctaStyle}>
        <div style={ctaCopyStyle}>
          <p style={ctaEyebrowStyle}>Next Step</p>
          <h2 style={ctaTitleStyle}>See how SignalForge IQ approaches crypto signals beyond alert volume.</h2>
          <p style={ctaBodyStyle}>
            Visit the signals page for the public preview, review the education hub, or contact the team if you want
            more detail on the platform experience.
          </p>
        </div>

        <div style={ctaActionsStyle}>
          <Link to="/signals" style={ctaPrimaryLinkStyle}>
            Explore signals
          </Link>
          <Link to="/education" style={ctaSecondaryLinkStyle}>
            Learn the system
          </Link>
          <Link to="/contact" style={ctaTextLinkStyle}>
            Contact SignalForge IQ
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
  borderRadius: "28px",
  border: "1px solid var(--color-hero-border)",
  background:
    "radial-gradient(circle at top left, rgba(147, 197, 253, 0.22), transparent 34%), linear-gradient(135deg, #0f172a 0%, #13263b 56%, #1c3f59 100%)",
  boxShadow: "0 20px 48px rgba(15, 23, 42, 0.14)",
};

const heroCopyStyle = {
  display: "grid",
  gap: "0.85rem",
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
  fontSize: "clamp(2.35rem, 4vw, 3.7rem)",
  lineHeight: 1.05,
  maxWidth: "14ch",
};

const heroBodyStyle = {
  margin: 0,
  color: "#e2e8f0",
  lineHeight: 1.75,
  maxWidth: "64ch",
  fontSize: "1.05rem",
};

const heroSupportStyle = {
  margin: 0,
  color: "#cbd5e1",
  lineHeight: 1.7,
  maxWidth: "62ch",
};

const heroActionsStyle = {
  display: "flex",
  gap: "0.8rem",
  flexWrap: "wrap" as const,
  alignItems: "center",
  marginTop: "0.25rem",
};

const primaryLinkStyle = {
  textDecoration: "none",
  padding: "0.95rem 1.2rem",
  borderRadius: "14px",
  backgroundColor: "#ffffff",
  color: "#101828",
  fontWeight: 700,
};

const secondaryLinkStyle = {
  textDecoration: "none",
  padding: "0.95rem 1.2rem",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.2)",
  backgroundColor: "rgba(255,255,255,0.08)",
  color: "#f8fafc",
  fontWeight: 700,
};

const heroTextLinkStyle = {
  textDecoration: "none",
  color: "#dbeafe",
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
  borderRadius: "20px",
  border: "1px solid rgba(255,255,255,0.14)",
  backgroundColor: "rgba(255,255,255,0.06)",
};

const heroPanelLabelStyle = {
  color: "#93c5fd",
  fontWeight: 700,
  fontSize: "0.78rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};

const heroPanelTitleStyle = {
  color: "#f8fafc",
  fontSize: "1.06rem",
};

const heroPanelBodyStyle = {
  margin: 0,
  color: "#d9e3ef",
  lineHeight: 1.65,
};

const heroMetricGridStyle = {
  display: "grid",
  gap: "0.8rem",
};

const heroMetricCardStyle = {
  display: "grid",
  gap: "0.35rem",
  padding: "1rem",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "rgba(255,255,255,0.04)",
};

const heroMetricTitleStyle = {
  color: "#f8fafc",
};

const heroMetricBodyStyle = {
  margin: 0,
  color: "#d0d5dd",
  lineHeight: 1.6,
};

const sectionCardStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.5rem",
  borderRadius: "24px",
  border: "1px solid var(--color-border-strong)",
  backgroundColor: "var(--color-surface)",
  boxShadow: "var(--shadow-soft)",
};

const sectionHeadingStyle = {
  display: "grid",
  gap: "0.45rem",
};

const sectionEyebrowStyle = {
  margin: 0,
  color: "var(--color-info-text)",
  fontWeight: 700,
  fontSize: "0.8rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};

const sectionTitleStyle = {
  margin: 0,
  color: "var(--color-text-primary)",
  fontSize: "2rem",
};

const sectionBodyStyle = {
  margin: 0,
  color: "var(--color-text-muted)",
  lineHeight: 1.75,
  maxWidth: "72ch",
};

const splitGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1rem",
};

const cardsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};

const infoCardStyle = {
  display: "grid",
  gap: "0.5rem",
  padding: "1.1rem",
  borderRadius: "18px",
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-surface-alt)",
};

const cardTitleStyle = {
  margin: 0,
  color: "var(--color-text-primary)",
  fontSize: "1.1rem",
};

const cardBodyStyle = {
  margin: 0,
  color: "var(--color-text-muted)",
  lineHeight: 1.65,
};

const bulletListStyle = {
  display: "grid",
  gap: "0.75rem",
};

const bulletRowStyle = {
  display: "flex",
  gap: "0.65rem",
  alignItems: "flex-start",
  padding: "0.95rem 1rem",
  borderRadius: "16px",
  backgroundColor: "var(--color-surface-alt)",
  border: "1px solid var(--color-border)",
  color: "var(--color-button-secondary-text)",
  lineHeight: 1.6,
};

const bulletMarkStyle = {
  color: "var(--color-info-text)",
  fontWeight: 800,
  lineHeight: 1.2,
};

const inlineLinkRowStyle = {
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

const ctaStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.6rem",
  borderRadius: "26px",
  border: "1px solid #1f2d43",
  background: "linear-gradient(135deg, #101828 0%, #172334 58%, #1d344d 100%)",
};

const ctaCopyStyle = {
  display: "grid",
  gap: "0.45rem",
};

const ctaEyebrowStyle = {
  margin: 0,
  color: "#93c5fd",
  fontWeight: 700,
  fontSize: "0.8rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};

const ctaTitleStyle = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "2rem",
  maxWidth: "20ch",
};

const ctaBodyStyle = {
  margin: 0,
  color: "#d0d5dd",
  lineHeight: 1.7,
  maxWidth: "66ch",
};

const ctaActionsStyle = {
  display: "flex",
  gap: "0.8rem",
  flexWrap: "wrap" as const,
  alignItems: "center",
};

const ctaPrimaryLinkStyle = {
  textDecoration: "none",
  padding: "0.95rem 1.2rem",
  borderRadius: "14px",
  backgroundColor: "#ffffff",
  color: "#101828",
  fontWeight: 700,
};

const ctaSecondaryLinkStyle = {
  textDecoration: "none",
  padding: "0.95rem 1.2rem",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.18)",
  backgroundColor: "rgba(255,255,255,0.06)",
  color: "#f8fafc",
  fontWeight: 700,
};

const ctaTextLinkStyle = {
  textDecoration: "none",
  color: "#dbeafe",
  fontWeight: 700,
};

export default CryptoTradingSignalsPage;

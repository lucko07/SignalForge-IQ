import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import TradingDisclaimer from "../components/TradingDisclaimer";

const performanceReasons = [
  {
    title: "Memory distorts decisions",
    body:
      "Without written review, traders often remember the biggest wins and losses but miss the patterns that actually drive long-term performance.",
  },
  {
    title: "Process needs evidence",
    body:
      "Tracking shows whether entries, risk management, and execution discipline are improving or slipping over time.",
  },
  {
    title: "Consistency compounds",
    body:
      "A trader who studies repeatable habits can improve decision quality faster than one who only focuses on the latest outcome.",
  },
] as const;

const measurementItems = [
  {
    title: "Entry quality",
    body: "Was the trade taken from the planned area, or did execution drift because of chasing or hesitation?",
  },
  {
    title: "Risk-to-reward profile",
    body: "A high win rate means little if the risk profile is consistently weak or inconsistent.",
  },
  {
    title: "Outcome by setup type",
    body: "Grouping trades by market condition or setup structure often reveals what actually deserves capital.",
  },
  {
    title: "Execution discipline",
    body: "Did the trade follow the plan, or was the result shaped by deviations in sizing, exits, or timing?",
  },
  {
    title: "Drawdown and streaks",
    body: "Performance tracking should help traders understand how rough periods affect process, confidence, and decision-making.",
  },
  {
    title: "Context around the alert",
    body: "Signals become more useful when traders can review the market context and trade state around each outcome.",
  },
] as const;

const analyticsGaps = [
  "Signals without review leave traders guessing whether the process is actually improving.",
  "Outcome alone can hide poor risk control, weak reward profiles, or repeated execution mistakes.",
  "Without analytics, it becomes harder to separate a disciplined trade from a lucky result.",
] as const;

const connectionSteps = [
  {
    title: "Alert arrives with a plan",
    body:
      "A structured signal should define the setup before execution so the trade can be evaluated against the original idea.",
  },
  {
    title: "Status and outcome are recorded",
    body:
      "Tracking the signal lifecycle creates a usable record of what happened rather than relying on hindsight or memory.",
  },
  {
    title: "Analytics reveal behavior over time",
    body:
      "Patterns in wins, losses, breakeven results, and execution quality help traders understand what is working and what needs attention.",
  },
  {
    title: "Review sharpens future decisions",
    body:
      "The real value of tracking is not only documentation. It is the ability to improve how the next trade is evaluated and managed.",
  },
] as const;

function TrackTradingPerformancePage() {
  return (
    <section style={pageStyle}>
      <Helmet>
        <title>Track Trading Performance | SignalForge IQ</title>
        <meta
          name="description"
          content="Learn how to track trading performance with structured analytics, outcome logging, and risk-based review so you can improve decision quality over time."
        />
      </Helmet>

      <div style={heroStyle}>
        <div style={heroCopyStyle}>
          <p style={eyebrowStyle}>Performance Review</p>
          <h1 style={heroTitleStyle}>Track Trading Performance with Clarity</h1>
          <p style={heroBodyStyle}>
            Performance tracking is how traders turn activity into evidence. It helps reveal whether results are being
            driven by a repeatable process or by short-term variance.
          </p>
          <p style={heroSupportStyle}>
            SignalForge IQ is built for traders who want more than alerts alone. The platform connects structured trade
            ideas with analytics, outcome logging, and a disciplined review mindset.
          </p>
          <div style={heroActionsStyle}>
            <Link to="/education" style={primaryLinkStyle}>
              Visit education
            </Link>
            <Link to="/pricing" style={secondaryLinkStyle}>
              Compare plans
            </Link>
            <Link to="/contact" style={heroTextLinkStyle}>
              Contact SignalForge IQ
            </Link>
          </div>
        </div>

        <div style={heroPanelStyle}>
          <div style={heroPanelCardStyle}>
            <span style={heroPanelLabelStyle}>Review loop</span>
            <strong style={heroPanelTitleStyle}>Signals create entries. Analytics create learning.</strong>
            <p style={heroPanelBodyStyle}>
              Serious traders benefit when alerts, outcomes, and review all live inside the same disciplined workflow.
            </p>
          </div>

          <div style={heroChecklistStyle}>
            {[
              "Measure results in context, not in isolation",
              "Review risk usage, not only win rate",
              "Turn logged outcomes into better future decisions",
            ].map((item) => (
              <div key={item} style={heroChecklistItemStyle}>
                <span aria-hidden="true" style={heroChecklistMarkStyle}>
                  +
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <article style={sectionCardStyle}>
        <div style={sectionHeadingStyle}>
          <p style={sectionEyebrowStyle}>Why It Matters</p>
          <h2 style={sectionTitleStyle}>Why tracking performance matters</h2>
          <p style={sectionBodyStyle}>
            Traders improve faster when they can review what happened with structure. Good tracking turns scattered
            trade history into an organized feedback loop that supports better judgment.
          </p>
        </div>

        <div style={cardsGridStyle}>
          {performanceReasons.map((item) => (
            <article key={item.title} style={infoCardStyle}>
              <h3 style={cardTitleStyle}>{item.title}</h3>
              <p style={cardBodyStyle}>{item.body}</p>
            </article>
          ))}
        </div>
      </article>

      <article style={sectionCardStyle}>
        <div style={sectionHeadingStyle}>
          <p style={sectionEyebrowStyle}>Metrics</p>
          <h2 style={sectionTitleStyle}>What traders should measure</h2>
          <p style={sectionBodyStyle}>
            The most useful performance review goes beyond total wins and losses. Traders benefit from studying the
            quality of the decision, the risk profile, and whether execution stayed aligned with the plan.
          </p>
        </div>

        <div style={cardsGridStyle}>
          {measurementItems.map((item) => (
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
            <p style={sectionEyebrowStyle}>Incomplete Process</p>
            <h2 style={sectionTitleStyle}>Why signals without analytics are incomplete</h2>
            <p style={sectionBodyStyle}>
              A signal can be well structured and still be hard to evaluate later if there is no disciplined review
              layer attached to it. Analytics help traders learn what the alert stream actually means in practice.
            </p>
          </div>

          <div style={bulletListStyle}>
            {analyticsGaps.map((item) => (
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
            <p style={sectionEyebrowStyle}>SignalForge IQ</p>
            <h2 style={sectionTitleStyle}>How SignalForge IQ helps connect alerts to outcomes</h2>
            <p style={sectionBodyStyle}>
              The platform is built around the idea that signals are most useful when they stay connected to lifecycle
              visibility, outcome tracking, and disciplined review over time.
            </p>
          </div>

          <div style={cardsGridStyle}>
            {connectionSteps.map((item) => (
              <article key={item.title} style={infoCardStyle}>
                <h3 style={cardTitleStyle}>{item.title}</h3>
                <p style={cardBodyStyle}>{item.body}</p>
              </article>
            ))}
          </div>

          <div style={inlineLinkRowStyle}>
            <Link to="/signals" style={inlineLinkStyle}>
              Visit the public signals page
            </Link>
            <Link to="/best-trading-signals" style={inlineMutedLinkStyle}>
              Read the signal quality guide
            </Link>
          </div>
        </article>
      </div>

      <div style={ctaStyle}>
        <div style={ctaCopyStyle}>
          <p style={ctaEyebrowStyle}>Next Step</p>
          <h2 style={ctaTitleStyle}>Build a workflow where signals, review, and accountability stay connected.</h2>
          <p style={ctaBodyStyle}>
            Explore the education hub, compare plans, or contact SignalForge IQ if you want to understand how the
            platform supports performance review for serious traders.
          </p>
        </div>

        <div style={ctaActionsStyle}>
          <Link to="/education" style={ctaPrimaryLinkStyle}>
            Go to education
          </Link>
          <Link to="/pricing" style={ctaSecondaryLinkStyle}>
            View pricing
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
    "radial-gradient(circle at top left, rgba(190, 214, 241, 0.22), transparent 34%), linear-gradient(135deg, #101828 0%, #172033 56%, #21405f 100%)",
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
  maxWidth: "13ch",
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

const heroChecklistStyle = {
  display: "grid",
  gap: "0.7rem",
};

const heroChecklistItemStyle = {
  display: "flex",
  gap: "0.65rem",
  alignItems: "flex-start",
  padding: "0.95rem 1rem",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "rgba(255,255,255,0.04)",
  color: "#e2e8f0",
  lineHeight: 1.6,
};

const heroChecklistMarkStyle = {
  color: "#93c5fd",
  fontWeight: 800,
  lineHeight: 1.2,
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

export default TrackTradingPerformancePage;

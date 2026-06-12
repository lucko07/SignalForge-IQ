import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import TradingDisclaimer from "../components/TradingDisclaimer";

const signalBuildingBlocks = [
  {
    title: "Clear trade structure",
    body:
      "A useful signal defines the market, direction, entry zone, invalidation level, and target logic before execution begins.",
  },
  {
    title: "Risk context",
    body:
      "Signals become more valuable when they show how risk is framed, rather than encouraging traders to react without a plan.",
  },
  {
    title: "Reviewable outcomes",
    body:
      "A professional signal process records what happened afterward so the service can be evaluated on discipline and consistency, not marketing copy.",
  },
] as const;

const failurePatterns = [
  "Entries are vague, late, or posted without clear invalidation.",
  "Providers optimize for volume and excitement instead of selectivity.",
  "There is no structured outcome logging, so performance cannot be reviewed honestly.",
  "Risk management is treated as an afterthought rather than part of the signal itself.",
] as const;

const qualityTraits = [
  {
    title: "Defined before the move",
    body: "The best signals outline entry, risk, and target logic before price reaches the decision point.",
  },
  {
    title: "Selective by design",
    body: "Quality usually comes from waiting for stronger structure, not forcing activity every hour.",
  },
  {
    title: "Built for execution",
    body: "Serious traders need information that supports calm decision-making instead of emotional reaction.",
  },
  {
    title: "Measured after the fact",
    body: "Good services review outcomes over time so traders can see whether the process stays disciplined.",
  },
] as const;

const differentiators = [
  {
    title: "Signals plus operating context",
    body:
      "SignalForge IQ combines structured alerts with market framing, trade lifecycle visibility, and disciplined member workflows.",
  },
  {
    title: "Risk-first presentation",
    body:
      "Every strong setup should make the downside as visible as the upside. That keeps the process grounded in risk rather than excitement.",
  },
  {
    title: "Performance tracking mindset",
    body:
      "The platform is built around reviewability so traders can connect the signal idea to the eventual outcome and learn over time.",
  },
] as const;

function BestTradingSignalsPage() {
  return (
    <section style={pageStyle}>
      <Helmet>
        <title>Best Trading Signals | SignalForge IQ</title>
        <meta
          name="description"
          content="Discover what separates high-quality trading signals from noise, and how SignalForge IQ combines disciplined entries, risk structure, and performance tracking."
        />
      </Helmet>

      <div style={heroStyle}>
        <div style={heroCopyStyle}>
          <p style={eyebrowStyle}>Signal Quality Guide</p>
          <h1 style={heroTitleStyle}>Best Trading Signals for Structured, Disciplined Trading</h1>
          <p style={heroBodyStyle}>
            The best trading signals do more than point to a market. They provide structure, define risk, and give
            traders a framework for making calmer decisions in real time.
          </p>
          <p style={heroSupportStyle}>
            SignalForge IQ is built for traders who want disciplined entries, clear trade context, and performance
            review instead of noise-driven alert streams.
          </p>
          <div style={heroActionsStyle}>
            <Link to="/signals" style={primaryLinkStyle}>
              Explore signals
            </Link>
            <Link to="/pricing" style={secondaryLinkStyle}>
              Compare plans
            </Link>
            <Link to="/education" style={heroTextLinkStyle}>
              Learn how the system works
            </Link>
          </div>
        </div>

        <div style={heroPanelStyle}>
          <div style={heroPanelCardStyle}>
            <span style={heroPanelLabelStyle}>What serious traders look for</span>
            <strong style={heroPanelTitleStyle}>A signal should help execution, not replace judgment.</strong>
            <p style={heroPanelBodyStyle}>
              Strong signal services reduce ambiguity. They make the entry plan, risk level, and review process easier
              to understand before any trade is taken.
            </p>
          </div>

          <div style={heroChecklistStyle}>
            {[
              "Defined entry and invalidation",
              "Risk-first positioning instead of hype",
              "Outcome review that supports accountability",
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
          <p style={sectionEyebrowStyle}>Signal Basics</p>
          <h2 style={sectionTitleStyle}>What trading signals are</h2>
          <p style={sectionBodyStyle}>
            Trading signals are structured trade ideas. In a disciplined process, they describe what market is being
            watched, which direction is favored, where the idea becomes actionable, and how risk should be controlled.
          </p>
        </div>

        <div style={cardsGridStyle}>
          {signalBuildingBlocks.map((item) => (
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
            <p style={sectionEyebrowStyle}>Common Problems</p>
            <h2 style={sectionTitleStyle}>Why many signal services fail</h2>
            <p style={sectionBodyStyle}>
              Many services confuse frequent alerts with real value. Traders may see plenty of activity, but very
              little structure, accountability, or support for disciplined execution.
            </p>
          </div>

          <div style={bulletListStyle}>
            {failurePatterns.map((item) => (
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
            <p style={sectionEyebrowStyle}>Quality Filter</p>
            <h2 style={sectionTitleStyle}>What makes a signal high-quality</h2>
            <p style={sectionBodyStyle}>
              A strong signal service favors clarity over hype. It gives traders the information needed to evaluate a
              setup instead of pushing them into rushed action.
            </p>
          </div>

          <div style={cardsGridStyle}>
            {qualityTraits.map((item) => (
              <article key={item.title} style={infoCardStyle}>
                <h3 style={cardTitleStyle}>{item.title}</h3>
                <p style={cardBodyStyle}>{item.body}</p>
              </article>
            ))}
          </div>
        </article>
      </div>

      <article style={sectionCardStyle}>
        <div style={sectionHeadingStyle}>
          <p style={sectionEyebrowStyle}>SignalForge IQ</p>
          <h2 style={sectionTitleStyle}>Why SignalForge IQ is different</h2>
          <p style={sectionBodyStyle}>
            SignalForge IQ is positioned as a premium, disciplined workflow for traders who care about decision quality
            as much as the alert itself. The platform is designed to connect trade ideas with structure, risk, and
            performance review.
          </p>
        </div>

        <div style={cardsGridStyle}>
          {differentiators.map((item) => (
            <article key={item.title} style={infoCardStyle}>
              <h3 style={cardTitleStyle}>{item.title}</h3>
              <p style={cardBodyStyle}>{item.body}</p>
            </article>
          ))}
        </div>
      </article>

      <div style={ctaStyle}>
        <div style={ctaCopyStyle}>
          <p style={ctaEyebrowStyle}>Next Step</p>
          <h2 style={ctaTitleStyle}>See how disciplined signals look inside the SignalForge IQ workflow.</h2>
          <p style={ctaBodyStyle}>
            Review the public signals page, compare plans, or reach out if you want a clearer picture of how the
            platform approaches structured trading decisions.
          </p>
        </div>

        <div style={ctaActionsStyle}>
          <Link to="/signals" style={ctaPrimaryLinkStyle}>
            Visit signals
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
    "radial-gradient(circle at top left, rgba(184, 214, 247, 0.24), transparent 34%), linear-gradient(135deg, #0f172a 0%, #172538 56%, #213a55 100%)",
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

export default BestTradingSignalsPage;

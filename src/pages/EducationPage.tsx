import { Link } from "react-router-dom";
import EducationVideoSection from "../components/EducationVideoSection";
import howTradingSignalsWorkImage from "../assets/education/How_A_Trading_signal_work.png";
import workflowDiagramImage from "../assets/education/work_flow_diagram.png";
import riskManagementImage from "../assets/education/Risk_Management.png";
import exampleSignalCardImage from "../assets/education/Example_signal_card.png";
import membershipOverviewImage from "../assets/education/Membership_Overview.png";

const signalFieldCards = [
  {
    title: "Symbol",
    description: "The market or instrument under review, such as BTC, EURUSD, or a stock ticker.",
  },
  {
    title: "Asset Type",
    description: "The market category involved, like crypto, forex, equities, or indices.",
  },
  {
    title: "Direction",
    description: "Whether the setup expects price to move higher (long) or lower (short).",
  },
  {
    title: "Entry",
    description: "The price area where the trade idea becomes actionable if conditions are met.",
  },
  {
    title: "Stop Loss",
    description: "The predefined exit level used to control downside when the setup fails.",
  },
  {
    title: "Target",
    description: "The intended area where profits may be taken if price moves as expected.",
  },
  {
    title: "Thesis",
    description: "The short explanation of why the trade exists and what supports the idea.",
  },
  {
    title: "Status",
    description: "The current stage of the signal, such as pending review, active, or closed.",
  },
] as const;

const riskPrinciples = [
  "Never risk more than you can afford to lose on a single trade.",
  "Use stop losses so every trade has a defined exit if the idea breaks down.",
  "Avoid overleveraging, especially when markets are moving quickly.",
  "Position sizing matters because even a strong setup can fail.",
  "Past performance does not guarantee future results.",
] as const;

const lifecycleSteps = [
  {
    title: "Pending Review",
    description: "The signal has been submitted but has not yet been approved for the live feed.",
  },
  {
    title: "Active",
    description: "The signal is live and the setup is considered actionable under the stated conditions.",
  },
  {
    title: "Closed",
    description: "The trade idea has finished and the result has been recorded in the system.",
  },
  {
    title: "Win / Loss / Breakeven",
    description: "Closed signals are categorized by outcome so users can review results with context.",
  },
] as const;

const membershipCards = [
  {
    title: "Free Users",
    description: "Free users can preview public content and get familiar with the platform experience.",
  },
  {
    title: "Pro and Elite",
    description: "Pro and Elite memberships unlock the protected dashboard and broader signal access.",
  },
  {
    title: "Growing With Your Account",
    description: "As your membership grows, your access expands into deeper tools, richer signal visibility, and a more complete member experience.",
  },
] as const;

function EducationPage() {
  return (
    <section style={pageStyle}>
      <div style={heroShellStyle}>
        <div style={heroTextColumnStyle}>
          <p style={eyebrowStyle}>Trading Education</p>
          <h1 style={heroTitleStyle}>Education</h1>
          <p style={heroDescriptionStyle}>
            SignalForge IQ helps traders understand signals, risk, and execution
            discipline so decisions are grounded in structure rather than emotion.
          </p>
          <p style={heroSupportStyle}>
            Use this page to build confidence in how signals are presented, how risk
            should be managed, and how account access works across the platform.
          </p>
          <div style={heroActionsStyle}>
            <Link to="/signals" style={primaryLinkStyle}>
              Explore signals
            </Link>
            <Link to="/pricing" style={secondaryLinkStyle}>
              View membership
            </Link>
          </div>
        </div>

        <div style={heroVisualCardStyle}>
          <img
            src={howTradingSignalsWorkImage}
            alt="Diagram showing how a trading signal works"
            style={heroImageStyle}
          />
        </div>
      </div>

      <EducationVideoSection
        title="How SignalForge IQ Works"
        eyebrow="48-Second Product Explainer"
        ctaTo="/pricing"
        ctaLabel="Explore Plans"
      />

      <article style={sectionCardStyle}>
        <div style={twoColumnSectionStyle}>
          <div style={sectionContentStyle}>
            <p style={sectionEyebrowStyle}>Signal Basics</p>
            <h2 style={sectionTitleStyle}>How to Read a Signal</h2>
            <p style={sectionDescriptionStyle}>
              Every signal is a compact trading plan. The goal is to show what market is
              being analyzed, what direction is expected, where risk is defined, and what
              outcome the trade is aiming for.
            </p>

            <div style={infoGridStyle}>
              {signalFieldCards.map((item) => (
                <div key={item.title} style={infoCardStyle}>
                  <h3 style={infoCardTitleStyle}>{item.title}</h3>
                  <p style={infoCardDescriptionStyle}>{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={sectionVisualStyle}>
            <img
              src={exampleSignalCardImage}
              alt="Example SignalForge IQ signal card"
              style={sectionImageStyle}
            />
          </div>
        </div>
      </article>

      <article style={sectionCardStyle}>
        <div style={twoColumnSectionStyle}>
          <div style={sectionContentStyle}>
            <p style={sectionEyebrowStyle}>Discipline</p>
            <h2 style={sectionTitleStyle}>Risk Management Basics</h2>
            <p style={sectionDescriptionStyle}>
              Risk management protects your capital and helps you stay consistent through
              both winning and losing periods. Good execution starts with respecting risk.
            </p>

            <div style={checkListStyle}>
              {riskPrinciples.map((principle) => (
                <div key={principle} style={checkListItemStyle}>
                  <span style={checkIconStyle}>+</span>
                  <span>{principle}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={sectionVisualStyle}>
            <img
              src={riskManagementImage}
              alt="Risk management illustration"
              style={sectionImageStyle}
            />
          </div>
        </div>
      </article>

      <article style={sectionCardStyle}>
        <div style={twoColumnSectionStyle}>
          <div style={sectionContentStyle}>
            <p style={sectionEyebrowStyle}>Workflow</p>
            <h2 style={sectionTitleStyle}>Signal Lifecycle</h2>
            <p style={sectionDescriptionStyle}>
              Signals move through a clear lifecycle so users always understand whether
              a setup is still being reviewed, live, or already resolved.
            </p>

            <div style={timelineStyle}>
              {lifecycleSteps.map((step, index) => (
                <div key={step.title} style={timelineItemStyle}>
                  <div style={timelineMarkerColumnStyle}>
                    <span style={timelineMarkerStyle}>{index + 1}</span>
                    {index < lifecycleSteps.length - 1 ? <span style={timelineLineStyle} /> : null}
                  </div>
                  <div style={timelineContentStyle}>
                    <h3 style={infoCardTitleStyle}>{step.title}</h3>
                    <p style={infoCardDescriptionStyle}>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={sectionVisualStyle}>
            <img
              src={workflowDiagramImage}
              alt="Workflow diagram of the signal lifecycle"
              style={sectionImageStyle}
            />
          </div>
        </div>
      </article>

      <article style={sectionCardStyle}>
        <div style={twoColumnSectionStyle}>
          <div style={sectionContentStyle}>
            <p style={sectionEyebrowStyle}>Access Tiers</p>
          <h2 style={sectionTitleStyle}>Membership Guidance</h2>
          <p style={sectionDescriptionStyle}>
            SignalForge IQ is structured so new users can explore publicly while paid
            members unlock a deeper product experience as their needs grow.
          </p>

            <div style={membershipGridStyle}>
              {membershipCards.map((item) => (
                <div key={item.title} style={membershipCardStyle}>
                  <h3 style={infoCardTitleStyle}>{item.title}</h3>
                  <p style={infoCardDescriptionStyle}>{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={sectionVisualStyle}>
            <img
              src={membershipOverviewImage}
              alt="Membership overview illustration"
              style={sectionImageStyle}
            />
          </div>
        </div>
      </article>

    </section>
  );
}

const pageStyle = {
  display: "grid",
  gap: "1.5rem",
  padding: "2rem 0",
};

const heroShellStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1.25rem",
  padding: "2rem",
  borderRadius: "28px",
  border: "1px solid #d0d5dd",
  background:
    "linear-gradient(135deg, rgba(16,24,40,1) 0%, rgba(29,41,57,1) 56%, rgba(71,84,103,1) 100%)",
  color: "#ffffff",
  boxShadow: "0 18px 45px rgba(16, 24, 40, 0.12)",
};

const heroTextColumnStyle = {
  display: "grid",
  gap: "1rem",
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
  fontSize: "2.8rem",
  lineHeight: 1.02,
};

const heroDescriptionStyle = {
  margin: 0,
  maxWidth: "620px",
  color: "#f2f4f7",
  fontSize: "1.08rem",
  lineHeight: 1.75,
};

const heroSupportStyle = {
  margin: 0,
  maxWidth: "640px",
  color: "#d0d5dd",
  lineHeight: 1.7,
};

const heroActionsStyle = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap" as const,
  marginTop: "0.25rem",
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
  border: "1px solid rgba(255,255,255,0.22)",
  backgroundColor: "rgba(255,255,255,0.08)",
  color: "#ffffff",
  fontWeight: 700,
};

const heroVisualCardStyle = {
  display: "grid",
  alignItems: "stretch",
  minHeight: "100%",
  padding: "0.5rem",
  borderRadius: "22px",
  backgroundColor: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
};

const heroImageStyle = {
  width: "100%",
  height: "100%",
  minHeight: "320px",
  objectFit: "cover" as const,
  borderRadius: "18px",
  display: "block",
};

const sectionCardStyle = {
  display: "grid",
  gap: "1.25rem",
  padding: "1.5rem",
  borderRadius: "24px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  boxShadow: "0 10px 30px rgba(16, 24, 40, 0.05)",
};

const twoColumnSectionStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1.25rem",
  alignItems: "center",
};

const sectionContentStyle = {
  display: "grid",
  gap: "1rem",
};

const sectionVisualStyle = {
  display: "grid",
  alignItems: "center",
};

const sectionImageStyle = {
  width: "100%",
  maxHeight: "420px",
  objectFit: "cover" as const,
  borderRadius: "20px",
  border: "1px solid #eaecf0",
  display: "block",
  backgroundColor: "#f8fafc",
};

const sectionEyebrowStyle = {
  margin: 0,
  color: "#475467",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  fontSize: "0.78rem",
};

const sectionTitleStyle = {
  margin: 0,
  color: "#101828",
  fontSize: "1.7rem",
};

const sectionDescriptionStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.72,
};

const infoGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "0.85rem",
};

const infoCardStyle = {
  display: "grid",
  gap: "0.45rem",
  padding: "1rem",
  borderRadius: "16px",
  border: "1px solid #eaecf0",
  backgroundColor: "#f8fafc",
};

const infoCardTitleStyle = {
  margin: 0,
  color: "#101828",
  fontSize: "1rem",
};

const infoCardDescriptionStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.6,
};

const checkListStyle = {
  display: "grid",
  gap: "0.75rem",
};

const checkListItemStyle = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "flex-start",
  padding: "0.9rem 1rem",
  borderRadius: "14px",
  backgroundColor: "#f8fafc",
  border: "1px solid #eaecf0",
  color: "#344054",
  lineHeight: 1.6,
};

const checkIconStyle = {
  color: "#101828",
  fontWeight: 800,
  lineHeight: 1.2,
};

const timelineStyle = {
  display: "grid",
  gap: "0.85rem",
};

const timelineItemStyle = {
  display: "grid",
  gridTemplateColumns: "32px minmax(0, 1fr)",
  gap: "0.9rem",
};

const timelineMarkerColumnStyle = {
  display: "grid",
  justifyItems: "center" as const,
  gridTemplateRows: "28px auto",
  gap: "0.35rem",
};

const timelineMarkerStyle = {
  width: "28px",
  height: "28px",
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  backgroundColor: "#101828",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "0.85rem",
};

const timelineLineStyle = {
  width: "2px",
  height: "100%",
  backgroundColor: "#d0d5dd",
  borderRadius: "999px",
};

const timelineContentStyle = {
  display: "grid",
  gap: "0.35rem",
  paddingBottom: "0.5rem",
};

const membershipGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "0.9rem",
};

const membershipCardStyle = {
  display: "grid",
  gap: "0.45rem",
  padding: "1rem",
  borderRadius: "16px",
  border: "1px solid #eaecf0",
  backgroundColor: "#f8fafc",
};

export default EducationPage;

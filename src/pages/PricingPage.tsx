import { Fragment } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { normalizeManagedPlan } from "../lib/userProfiles";

type PlanKey = "pro" | "elite";

type PlanDefinition = {
  key: PlanKey;
  name: string;
  label: string;
  price: string;
  summary: string;
  positioning: string;
  bullets: string[];
  lockedPreview?: string[];
  recommendation?: string;
};

const plans: PlanDefinition[] = [
  {
    key: "pro",
    name: "Pro",
    label: "Decision Engine",
    price: "$49/mo",
    summary:
      "For traders who want clearer decisions, stronger context, and disciplined signal monitoring before taking action.",
    positioning:
      "Pro gives members qualified setups, confidence framing, analytics, and market context in one clean operating view.",
    bullets: [
      "Use the live BTC Precision Engine inside a disciplined member workspace",
      "Use confidence scoring and market context to filter weaker setups",
      "Review analytics and trade history to stay disciplined over time",
      "See BTC Momentum Engine as an upcoming module without relying on it as a live product",
    ],
    lockedPreview: [
      "Automation is visible but locked on Pro",
      "Routing and advanced delivery controls activate on Elite",
    ],
  },
  {
    key: "elite",
    name: "Elite",
    label: "Execution System",
    price: "$99/mo",
    summary:
      "For serious operators who want SignalForge IQ to move from insight into live operational readiness.",
    positioning:
      "Elite adds the execution layer with delivery controls, automation access, and routing designed for faster, more consistent response.",
    bullets: [
      "Operate with the full Decision Engine plus the execution layer",
      "Activate automation and signal routing from one account environment",
      "Keep delivery controls ready for real-time execution workflows",
      "Built for members who want disciplined operation at speed",
    ],
    lockedPreview: [
      "Elite unlocks execution-ready delivery",
      "Advanced routing and automation controls are included",
    ],
    recommendation: "Most serious users choose Elite",
  },
] as const;

const valueBlocks = [
  {
    title: "Not Just Signals",
    body:
      "SignalForge IQ is designed to turn trade ideas into a repeatable decision process with confidence, context, and post-trade visibility.",
  },
  {
    title: "Built For Execution",
    body:
      "Elite extends the product from decision support into operational readiness with delivery controls, automation access, and routing that stays prepared for qualified setups.",
  },
  {
    title: "Designed For Consistency",
    body:
      "The platform reinforces daily discipline with signal monitoring, waiting-for-confirmation states, and messaging built to avoid overtrading.",
  },
] as const;

const comparisonRows = [
  {
    label: "BTC Precision Engine",
    pro: "Included",
    elite: "Included",
  },
  {
    label: "BTC Momentum Engine",
    pro: "Coming soon",
    elite: "Coming soon",
  },
  {
    label: "Confidence Score",
    pro: "Included",
    elite: "Included",
  },
  {
    label: "Analytics",
    pro: "Included",
    elite: "Included",
  },
  {
    label: "Market Context",
    pro: "Included",
    elite: "Included",
  },
  {
    label: "Delivery Controls",
    pro: "Visible, locked",
    elite: "Included",
  },
  {
    label: "Automation",
    pro: "Upgrade to activate",
    elite: "Included",
  },
  {
    label: "Routing / Execution Readiness",
    pro: "Preview only",
    elite: "Included",
  },
] as const;

const trustItems = [
  {
    title: "Risk-First Operation",
    body:
      "The product is framed around qualified setups, market context, and controlled execution rather than chasing constant activity.",
  },
  {
    title: "No Overtrading",
    body:
      "When no high-quality setup is detected, the system is still doing its job by monitoring conditions and waiting for confirmation.",
  },
  {
    title: "Built For Real Traders",
    body:
      "SignalForge IQ is positioned for disciplined users who value consistency, structure, and credible operating workflows.",
  },
] as const;

function PricingPage() {
  const { currentUser, loading, profile } = useAuth();
  const isLoggedIn = Boolean(currentUser);
  const currentPlan = normalizeManagedPlan(profile?.currentPlan ?? profile?.plan ?? "free");
  const effectivePlan = currentPlan === "admin" ? "elite" : currentPlan;

  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <div style={heroHeaderStyle}>
          <span style={eyebrowStyle}>SignalForge IQ Membership</span>
          <span style={heroPillStyle}>Decision Engine + Execution System</span>
        </div>

        <div style={heroGridStyle}>
          <div style={heroCopyStyle}>
            <h1 style={heroTitleStyle}>Signals are the input. SignalForge IQ is the operating system around them.</h1>
            <p style={heroBodyStyle}>
              Pro gives members live access to BTC Precision Engine with qualified setups, confidence, analytics, and market context.
              Elite adds the execution layer with automation, routing, and delivery controls built for serious operators.
            </p>
            <p style={heroSubBodyStyle}>
              Daily value does not depend on constant trades. The platform stays useful through signal monitoring,
              waiting-for-confirmation states, and disciplined visibility into market conditions while BTC Momentum remains in development.
            </p>

            <div style={heroActionsStyle}>
              <Link
                to={isLoggedIn ? "/upgrade?plan=elite" : "/signup?plan=elite"}
                style={primaryHeroLinkStyle}
              >
                {isLoggedIn ? "Upgrade to Elite" : "Start with Elite"}
              </Link>
              <a href="#plans" style={secondaryHeroLinkStyle}>
                Compare Pro and Elite
              </a>
            </div>

            <p style={heroNoteStyle}>
              More than signals: SignalForge IQ combines qualified setup monitoring, decision support, and execution readiness in one premium workflow.
            </p>

            {isLoggedIn && !loading ? (
              <p style={currentPlanStyle}>
                Current access: <strong>{capitalizeLabel(effectivePlan)}</strong>
              </p>
            ) : null}
          </div>

          <div style={heroPanelStyle}>
            <div style={heroPanelCardStyle}>
              <span style={heroPanelLabelStyle}>Daily Value Loop</span>
              <strong style={heroPanelTitleStyle}>System monitoring for qualified setups</strong>
              <p style={heroPanelBodyStyle}>
                When conditions are weak, the disciplined state is not inactivity. It is active monitoring, filtering,
                and waiting for confirmation.
              </p>
            </div>
            <div style={heroPanelStackStyle}>
              <StatusRow
                title="BTC Precision Engine live"
                detail="Qualified setups are delivered with confidence framing and market context."
              />
              <StatusRow
                title="Monitoring BTC for qualified precision setups"
                detail="The system remains active while structure, trend, and confirmation are reviewed."
              />
              <StatusRow
                title="BTC Momentum Engine coming soon"
                detail="Designed to add future BTC opportunity flow without being presented as live before it is ready."
              />
            </div>
          </div>
        </div>
      </div>

      <div style={valueGridStyle}>
        {valueBlocks.map((item) => (
          <article key={item.title} style={valueCardStyle}>
            <h2 style={valueTitleStyle}>{item.title}</h2>
            <p style={valueBodyStyle}>{item.body}</p>
          </article>
        ))}
      </div>

      <div id="plans" style={plansSectionStyle}>
        <div style={sectionHeadingStyle}>
          <span style={sectionEyebrowStyle}>Plans</span>
          <h2 style={sectionTitleStyle}>Choose between decision support and full operational readiness.</h2>
          <p style={sectionBodyStyle}>
            The plan structure is simple by design. Pro helps members make better decisions. Elite helps them operate faster and more consistently.
          </p>
        </div>

        <div style={plansGridStyle}>
          {plans.map((plan) => {
            const cta = getPlanCta(plan.key, effectivePlan, isLoggedIn, loading);
            const featured = plan.key === "elite";

            return (
              <article key={plan.key} style={planCardStyle(featured)}>
                <div style={planTopStyle}>
                  <div style={planTitleBlockStyle}>
                    <span style={planLabelStyle}>{plan.label}</span>
                    <h3 style={planNameStyle}>{plan.name}</h3>
                  </div>
                  {plan.recommendation ? <span style={featuredBadgeStyle}>{plan.recommendation}</span> : null}
                </div>

                <div style={priceBlockStyle}>
                  <strong style={priceStyle}>{plan.price}</strong>
                  <p style={planSummaryStyle}>{plan.summary}</p>
                </div>

                <p style={planPositioningStyle}>{plan.positioning}</p>

                <div style={benefitListStyle}>
                  {plan.bullets.map((bullet) => (
                    <div key={bullet} style={benefitRowStyle}>
                      <span aria-hidden="true" style={benefitMarkStyle}>+</span>
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>

                {plan.lockedPreview ? (
                  <div style={lockedPreviewStyle(featured)}>
                    <strong style={lockedPreviewTitleStyle}>Upgrade pressure, handled cleanly</strong>
                    <div style={lockedPreviewListStyle}>
                      {plan.lockedPreview.map((item) => (
                        <div key={item} style={lockedPreviewItemStyle}>
                          <span aria-hidden="true" style={lockedPreviewLockStyle}>LOCKED</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {cta.kind === "link" ? (
                  <Link to={cta.to} style={planCtaStyle(featured)}>
                    {cta.label}
                  </Link>
                ) : (
                  <span style={planStatusStyle(cta.kind === "current")}>{cta.label}</span>
                )}
              </article>
            );
          })}
        </div>
      </div>

      <div style={comparisonSectionStyle}>
        <div style={sectionHeadingStyle}>
          <span style={sectionEyebrowStyle}>Comparison</span>
          <h2 style={sectionTitleStyle}>What changes when a member moves from Pro to Elite.</h2>
          <p style={sectionBodyStyle}>
            The Decision Engine is already powerful. Elite becomes the natural upgrade when a user wants execution-ready delivery, automation, and routing controls.
          </p>
        </div>

        <div style={comparisonTableStyle}>
          <div style={comparisonHeadCellStyle}>Capability</div>
          <div style={comparisonHeadCellStyle}>Pro</div>
          <div style={comparisonFeaturedHeadCellStyle}>Elite</div>

          {comparisonRows.map((row) => (
            <Fragment key={row.label}>
              <div style={comparisonLabelCellStyle}>{row.label}</div>
              <div style={comparisonCellStyle(row.pro.includes("locked") || row.pro.includes("Upgrade") || row.pro.includes("Preview"))}>
                {row.pro}
              </div>
              <div style={comparisonFeaturedCellStyle}>{row.elite}</div>
            </Fragment>
          ))}
        </div>
      </div>

      <div style={trustSectionStyle}>
        <div style={sectionHeadingStyle}>
          <span style={sectionEyebrowStyle}>Trust Layer</span>
          <h2 style={sectionTitleStyle}>Disciplined by design.</h2>
          <p style={sectionBodyStyle}>
            SignalForge IQ is positioned as a calm, premium trading operations platform. The experience favors discipline, timing, and consistency over noise.
          </p>
        </div>

        <div style={trustGridStyle}>
          {trustItems.map((item) => (
            <article key={item.title} style={trustCardStyle}>
              <h3 style={trustTitleStyle}>{item.title}</h3>
              <p style={trustBodyStyle}>{item.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div style={footerCtaStyle}>
        <div style={footerCopyStyle}>
          <span style={sectionEyebrowStyle}>Upgrade Path</span>
          <h2 style={footerTitleStyle}>Start with better decisions. Move to faster execution when your workflow is ready.</h2>
          <p style={footerBodyStyle}>
            Pro is the right choice for clarity before action. Elite is the right choice when delivery, automation, and routing become part of the daily operating loop.
          </p>
        </div>
        <div style={footerActionsStyle}>
          <Link
            to={isLoggedIn ? "/upgrade?plan=pro" : "/signup?plan=pro"}
            style={footerSecondaryLinkStyle}
          >
            Start Pro
          </Link>
          <Link
            to={isLoggedIn ? "/upgrade?plan=elite" : "/signup?plan=elite"}
            style={footerPrimaryLinkStyle}
          >
            Unlock Elite
          </Link>
        </div>
      </div>
    </section>
  );
}

function StatusRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={statusRowStyle}>
      <strong style={statusRowTitleStyle}>{title}</strong>
      <p style={statusRowBodyStyle}>{detail}</p>
    </div>
  );
}

const getPlanCta = (
  targetPlan: PlanKey,
  currentPlan: "free" | "pro" | "elite",
  isLoggedIn: boolean,
  isLoadingPlan: boolean
) => {
  if (isLoadingPlan) {
    return { kind: "status", label: "Checking access" } as const;
  }

  if (targetPlan === currentPlan) {
    return { kind: "current", label: "Current plan" } as const;
  }

  if (currentPlan === "elite" && targetPlan === "pro") {
    return { kind: "status", label: "Elite already active" } as const;
  }

  if (isLoggedIn) {
    return {
      kind: "link",
      label: targetPlan === "pro" ? "Upgrade to Pro" : "Move to Elite",
      to: `/upgrade?plan=${targetPlan}`,
    } as const;
  }

  return {
    kind: "link",
    label: targetPlan === "pro" ? "Get Pro" : "Choose Elite",
    to: `/signup?plan=${targetPlan}`,
  } as const;
};

const capitalizeLabel = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

const pageStyle = {
  display: "grid",
  gap: "1.5rem",
  padding: "2rem 0",
};

const heroStyle = {
  display: "grid",
  gap: "1.4rem",
  padding: "2rem",
  borderRadius: "28px",
  border: "1px solid #d7dde7",
  background:
    "radial-gradient(circle at top left, rgba(184, 214, 247, 0.28), transparent 34%), linear-gradient(135deg, #0f172a 0%, #1a2940 52%, #29425d 100%)",
  boxShadow: "0 22px 54px rgba(15, 23, 42, 0.16)",
};

const heroHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "1rem",
  alignItems: "center",
  flexWrap: "wrap" as const,
};

const eyebrowStyle = {
  color: "#d8e1ee",
  fontSize: "0.82rem",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
};

const heroPillStyle = {
  padding: "0.45rem 0.8rem",
  borderRadius: "999px",
  border: "1px solid rgba(226, 232, 240, 0.22)",
  backgroundColor: "rgba(255,255,255,0.08)",
  color: "#f8fafc",
  fontWeight: 700,
  fontSize: "0.88rem",
};

const heroGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.55fr) minmax(280px, 0.95fr)",
  gap: "1.25rem",
};

const heroCopyStyle = {
  display: "grid",
  gap: "0.85rem",
};

const heroTitleStyle = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "clamp(2.35rem, 4vw, 3.8rem)",
  lineHeight: 1.05,
  maxWidth: "13ch",
};

const heroBodyStyle = {
  margin: 0,
  color: "#d9e3ef",
  lineHeight: 1.75,
  maxWidth: "66ch",
  fontSize: "1.04rem",
};

const heroSubBodyStyle = {
  margin: 0,
  color: "#bcc9d8",
  lineHeight: 1.7,
  maxWidth: "62ch",
};

const heroActionsStyle = {
  display: "flex",
  gap: "0.8rem",
  flexWrap: "wrap" as const,
  marginTop: "0.25rem",
};

const primaryHeroLinkStyle = {
  textDecoration: "none",
  padding: "0.95rem 1.2rem",
  borderRadius: "14px",
  backgroundColor: "#ebf2fb",
  color: "#0f172a",
  fontWeight: 700,
};

const secondaryHeroLinkStyle = {
  textDecoration: "none",
  padding: "0.95rem 1.2rem",
  borderRadius: "14px",
  border: "1px solid rgba(226, 232, 240, 0.22)",
  color: "#f8fafc",
  fontWeight: 700,
  backgroundColor: "rgba(255,255,255,0.04)",
};

const heroNoteStyle = {
  margin: 0,
  color: "#d8e1ee",
  lineHeight: 1.7,
};

const currentPlanStyle = {
  margin: 0,
  color: "#cbd5e1",
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
  border: "1px solid rgba(226, 232, 240, 0.14)",
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
  fontSize: "1.05rem",
};

const heroPanelBodyStyle = {
  margin: 0,
  color: "#d9e3ef",
  lineHeight: 1.65,
};

const heroPanelStackStyle = {
  display: "grid",
  gap: "0.7rem",
};

const statusRowStyle = {
  display: "grid",
  gap: "0.25rem",
  padding: "0.9rem 1rem",
  borderRadius: "16px",
  border: "1px solid rgba(226, 232, 240, 0.12)",
  backgroundColor: "rgba(255,255,255,0.04)",
};

const statusRowTitleStyle = {
  color: "#f8fafc",
};

const statusRowBodyStyle = {
  margin: 0,
  color: "#cbd5e1",
  lineHeight: 1.6,
};

const valueGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: "1rem",
};

const valueCardStyle = {
  display: "grid",
  gap: "0.55rem",
  padding: "1.3rem",
  borderRadius: "20px",
  border: "1px solid #d7dde7",
  backgroundColor: "#ffffff",
};

const valueTitleStyle = {
  margin: 0,
  color: "#0f172a",
  fontSize: "1.12rem",
};

const valueBodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.7,
};

const plansSectionStyle = {
  display: "grid",
  gap: "1.2rem",
};

const sectionHeadingStyle = {
  display: "grid",
  gap: "0.45rem",
};

const sectionEyebrowStyle = {
  color: "#365c8c",
  fontWeight: 700,
  fontSize: "0.82rem",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
};

const sectionTitleStyle = {
  margin: 0,
  color: "#0f172a",
  fontSize: "2rem",
};

const sectionBodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.75,
  maxWidth: "72ch",
};

const plansGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
  gap: "1rem",
};

const planCardStyle = (featured: boolean) => ({
  display: "grid",
  gap: "1rem",
  padding: "1.5rem",
  borderRadius: "24px",
  border: featured ? "1px solid #1f3a5b" : "1px solid #d7dde7",
  background: featured
    ? "linear-gradient(180deg, #eef4fb 0%, #e3edf9 100%)"
    : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  boxShadow: featured ? "0 18px 40px rgba(31, 58, 91, 0.12)" : "none",
  position: "relative" as const,
});

const planTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "0.8rem",
};

const planTitleBlockStyle = {
  display: "grid",
  gap: "0.25rem",
};

const planLabelStyle = {
  color: "#365c8c",
  fontSize: "0.8rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};

const planNameStyle = {
  margin: 0,
  color: "#0f172a",
  fontSize: "1.9rem",
};

const featuredBadgeStyle = {
  padding: "0.45rem 0.75rem",
  borderRadius: "999px",
  backgroundColor: "#0f172a",
  color: "#f8fafc",
  fontSize: "0.78rem",
  fontWeight: 700,
  textAlign: "center" as const,
};

const priceBlockStyle = {
  display: "grid",
  gap: "0.35rem",
};

const priceStyle = {
  color: "#0f172a",
  fontSize: "2.4rem",
  lineHeight: 1,
};

const planSummaryStyle = {
  margin: 0,
  color: "#162033",
  fontWeight: 700,
  lineHeight: 1.6,
};

const planPositioningStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.7,
};

const benefitListStyle = {
  display: "grid",
  gap: "0.65rem",
};

const benefitRowStyle = {
  display: "flex",
  gap: "0.6rem",
  color: "#344054",
  lineHeight: 1.6,
};

const benefitMarkStyle = {
  color: "#1f3a5b",
  fontWeight: 700,
};

const lockedPreviewStyle = (featured: boolean) => ({
  display: "grid",
  gap: "0.6rem",
  padding: "1rem",
  borderRadius: "16px",
  border: featured ? "1px solid #c5d5ea" : "1px solid #d7dde7",
  backgroundColor: featured ? "rgba(255,255,255,0.72)" : "#ffffff",
});

const lockedPreviewTitleStyle = {
  color: "#0f172a",
};

const lockedPreviewListStyle = {
  display: "grid",
  gap: "0.55rem",
};

const lockedPreviewItemStyle = {
  display: "flex",
  gap: "0.6rem",
  color: "#475467",
  lineHeight: 1.55,
};

const lockedPreviewLockStyle = {
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  color: "#9a3412",
};

const planCtaStyle = (featured: boolean) => ({
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "0.95rem 1.2rem",
  borderRadius: "14px",
  backgroundColor: featured ? "#0f172a" : "#ffffff",
  color: featured ? "#f8fafc" : "#0f172a",
  border: featured ? "1px solid #0f172a" : "1px solid #d0d5dd",
  fontWeight: 700,
});

const planStatusStyle = (isCurrent: boolean) => ({
  textAlign: "center" as const,
  padding: "0.95rem 1.2rem",
  borderRadius: "14px",
  backgroundColor: isCurrent ? "#ecfdf3" : "#f2f4f7",
  color: isCurrent ? "#027a48" : "#344054",
  border: isCurrent ? "1px solid #abefc6" : "1px solid #d0d5dd",
  fontWeight: 700,
});

const comparisonSectionStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.4rem",
  borderRadius: "24px",
  border: "1px solid #d7dde7",
  backgroundColor: "#ffffff",
};

const comparisonTableStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1.6fr) repeat(2, minmax(130px, 1fr))",
  borderRadius: "18px",
  overflow: "hidden",
  border: "1px solid #e4e7ec",
};

const comparisonHeadCellStyle = {
  padding: "0.95rem 1rem",
  backgroundColor: "#f8fafc",
  borderBottom: "1px solid #e4e7ec",
  color: "#475467",
  fontWeight: 700,
};

const comparisonFeaturedHeadCellStyle = {
  ...comparisonHeadCellStyle,
  backgroundColor: "#0f172a",
  color: "#f8fafc",
};

const comparisonLabelCellStyle = {
  padding: "0.95rem 1rem",
  borderBottom: "1px solid #e4e7ec",
  backgroundColor: "#ffffff",
  color: "#0f172a",
  fontWeight: 600,
};

const comparisonCellStyle = (isLocked: boolean) => ({
  padding: "0.95rem 1rem",
  borderBottom: "1px solid #e4e7ec",
  backgroundColor: isLocked ? "#fff7ed" : "#ffffff",
  color: isLocked ? "#9a3412" : "#475467",
  fontWeight: isLocked ? 700 : 500,
});

const comparisonFeaturedCellStyle = {
  padding: "0.95rem 1rem",
  borderBottom: "1px solid #e4e7ec",
  backgroundColor: "#f5f8fd",
  color: "#0f172a",
  fontWeight: 700,
};

const trustSectionStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.5rem",
  borderRadius: "24px",
  border: "1px solid #d7dde7",
  background: "linear-gradient(180deg, #f8fafc 0%, #eef3f9 100%)",
};

const trustGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};

const trustCardStyle = {
  display: "grid",
  gap: "0.45rem",
  padding: "1.15rem",
  borderRadius: "18px",
  border: "1px solid #d7dde7",
  backgroundColor: "#ffffff",
};

const trustTitleStyle = {
  margin: 0,
  color: "#0f172a",
  fontSize: "1.05rem",
};

const trustBodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.7,
};

const footerCtaStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap" as const,
  padding: "1.6rem",
  borderRadius: "24px",
  border: "1px solid #d7dde7",
  background: "linear-gradient(135deg, #dce7f6 0%, #f7fbff 100%)",
};

const footerCopyStyle = {
  display: "grid",
  gap: "0.35rem",
};

const footerTitleStyle = {
  margin: 0,
  color: "#0f172a",
  fontSize: "2rem",
  maxWidth: "18ch",
};

const footerBodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.7,
  maxWidth: "60ch",
};

const footerActionsStyle = {
  display: "flex",
  gap: "0.8rem",
  flexWrap: "wrap" as const,
};

const footerPrimaryLinkStyle = {
  textDecoration: "none",
  padding: "0.95rem 1.2rem",
  borderRadius: "14px",
  backgroundColor: "#0f172a",
  color: "#f8fafc",
  fontWeight: 700,
};

const footerSecondaryLinkStyle = {
  textDecoration: "none",
  padding: "0.95rem 1.2rem",
  borderRadius: "14px",
  border: "1px solid #c5ceda",
  backgroundColor: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
};

export default PricingPage;

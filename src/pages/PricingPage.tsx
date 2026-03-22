import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import TradingDisclaimer from "../components/TradingDisclaimer";
import { useAuth } from "../context/auth-context";
import { getUserProfile } from "../lib/firestore";
import type { UserPlan } from "../lib/firestore";

type Tier = {
  name: "Free" | "Pro" | "Elite";
  plan: "free" | "pro" | "elite";
  price: string;
  kicker: string;
  description: string;
  features: string[];
  bestFor: string;
  featured: boolean;
};

const pricingTiers: Tier[] = [
  {
    name: "Free",
    plan: "free",
    price: "$0",
    kicker: "Get familiar",
    description: "Public preview access for visitors and new users.",
    features: [
      "Public signal preview only",
      "Up to 3 recent signals on /signals",
      "No protected dashboard access",
    ],
    bestFor: "Best for exploring the platform before stepping into a paid membership.",
    featured: false,
  },
  {
    name: "Pro",
    plan: "pro",
    price: "$49",
    kicker: "Core membership",
    description: "Protected dashboard access with live signals, closed trade history, and performance tracking.",
    features: [
      "Protected dashboard access",
      "Live signals",
      "Closed trade history",
      "Performance tracking",
    ],
    bestFor: "Best for active traders who want the full core SignalForge IQ experience.",
    featured: true,
  },
  {
    name: "Elite",
    plan: "elite",
    price: "$99",
    kicker: "Premium tier",
    description: "Everything in Pro plus higher-tier premium access and future expanded member benefits.",
    features: [
      "Everything in Pro",
      "Higher-tier premium access",
      "Future expanded member benefits",
    ],
    bestFor: "Best for members who want the highest-access tier and first access to premium expansion.",
    featured: false,
  },
] as const;

const reassuranceItems = [
  {
    title: "Quality Over Quantity",
    body:
      "Signal frequency depends on market conditions and setup quality. SignalForge IQ prioritizes selective opportunities over a fixed posting schedule.",
  },
  {
    title: "Flexible Membership",
    body:
      "Paid memberships are designed to stay manageable. If cancellation is scheduled for period end, access remains active through the current billing period.",
  },
  {
    title: "Educational Use",
    body:
      "SignalForge IQ provides structured trade ideas, market education, and performance visibility. It does not guarantee results or replace your own judgment.",
  },
] as const;

const pricingQuestions = [
  {
    question: "Which plan fits most members best?",
    answer:
      "Pro is the best fit for most active members because it includes the protected dashboard, live signals, closed trade history, and performance tracking.",
  },
  {
    question: "Why choose Elite?",
    answer:
      "Elite is designed for members who want everything in Pro plus higher-tier premium access and first access to expanded member benefits as the platform grows.",
  },
  {
    question: "Do you guarantee a set number of signals?",
    answer:
      "No. Signal frequency depends on market conditions and setup quality, so the focus stays on disciplined setups rather than volume promises.",
  },
] as const;

const planComparisonRows = [
  {
    label: "Protected dashboard access",
    free: "Preview only",
    pro: "Included",
    elite: "Included",
  },
  {
    label: "Live signals",
    free: "Public preview only",
    pro: "Included",
    elite: "Included",
  },
  {
    label: "Closed trade history",
    free: "Not included",
    pro: "Included",
    elite: "Included",
  },
  {
    label: "Performance tracking",
    free: "Not included",
    pro: "Included",
    elite: "Included",
  },
  {
    label: "Premium access level",
    free: "Public access",
    pro: "Core membership",
    elite: "Higher-tier premium access",
  },
  {
    label: "Future expanded member benefits",
    free: "Not included",
    pro: "Standard access",
    elite: "Priority tier",
  },
] as const;

function PricingPage() {
  const { currentUser, loading } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<UserPlan>("free");
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (!currentUser) {
        if (isMounted) {
          setCurrentPlan("free");
          setIsProfileLoading(false);
        }

        return;
      }

      try {
        const profile = await getUserProfile(currentUser.uid);

        if (isMounted) {
          setCurrentPlan(profile?.plan ?? "free");
        }
      } catch {
        if (isMounted) {
          setCurrentPlan("free");
        }
      } finally {
        if (isMounted) {
          setIsProfileLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const isLoggedIn = !!currentUser;
  const effectivePlan = currentPlan === "admin" ? "elite" : currentPlan;
  const isLoadingPlan = loading || (isLoggedIn && isProfileLoading);

  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <p style={heroEyebrowStyle}>Membership Access</p>
        <h1 style={heroTitleStyle}>Choose the membership that fits how you trade.</h1>
        <p style={heroBodyStyle}>
          Start with Free to explore the platform. Upgrade to Pro for the full working member experience,
          or choose Elite for higher-tier premium access and future expanded member benefits.
        </p>
        <p style={heroNoteStyle}>
          SignalForge IQ is built around selective setups, clear history, and practical performance visibility.
        </p>
        <div style={heroActionsStyle}>
          <Link to={isLoggedIn ? "/upgrade?plan=pro" : "/signup?plan=pro"} style={heroPrimaryLinkStyle}>
            {isLoggedIn ? "Upgrade to Pro" : "Start with Pro"}
          </Link>
          <a href="#plan-comparison" style={heroSecondaryLinkStyle}>
            Compare plans
          </a>
        </div>
        {isLoggedIn && !isLoadingPlan ? (
          <p style={heroCurrentPlanStyle}>
            Current plan: <strong>{currentPlan}</strong>
          </p>
        ) : null}
      </div>

      <div style={tiersGridStyle}>
        {pricingTiers.map((tier) => {
          const tierState = getTierState(tier.plan, effectivePlan, isLoggedIn, isLoadingPlan);

          return (
            <article key={tier.name} style={tierCardStyle(tier.featured)}>
              <div style={tierHeaderStyle}>
                <div style={tierHeadingBlockStyle}>
                  <span style={tierKickerStyle}>{tier.kicker}</span>
                  <h2 style={tierTitleStyle}>{tier.name}</h2>
                </div>
                {tier.featured ? <span style={featuredPillStyle}>Best Value</span> : null}
              </div>

              <div style={tierPriceBlockStyle}>
                <strong style={tierPriceStyle}>{tier.price}</strong>
                <p style={tierDescriptionStyle}>{tier.description}</p>
                <p style={tierBestForStyle}>{tier.bestFor}</p>
              </div>

              <div style={tierFeatureListStyle}>
                {tier.features.map((feature) => (
                  <div key={feature} style={tierFeatureRowStyle}>
                    <span aria-hidden="true" style={tierFeatureIconStyle}>
                      +
                    </span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              {tierState.kind === "link" ? (
                <Link to={tierState.to} style={ctaStyle(tier.featured)}>
                  {tierState.label}
                </Link>
              ) : (
                <span style={statusPillStyle(tierState.kind === "current")}>
                  {tierState.label}
                </span>
              )}
            </article>
          );
        })}
      </div>

      <div style={reassuranceGridStyle}>
        {reassuranceItems.map((item) => (
          <article key={item.title} style={reassuranceCardStyle}>
            <h2 style={reassuranceTitleStyle}>{item.title}</h2>
            <p style={reassuranceBodyStyle}>{item.body}</p>
          </article>
        ))}
      </div>

      <div style={rulesCardStyle}>
        <h2 style={rulesTitleStyle}>Membership Snapshot</h2>
        <p style={rulesBodyStyle}>
          Free users can access public pages and recent previews. Pro unlocks the protected dashboard, live signals,
          closed trade history, and performance tracking. Elite includes everything in Pro, with higher-tier premium
          positioning and future expanded benefits.
        </p>
        <p style={rulesNoteStyle}>
          If you want the full core experience, Pro is the strongest starting point. If you want the highest-access
          tier and premium positioning as the platform expands, choose Elite.
        </p>
      </div>

      <div id="plan-comparison" style={comparisonSectionStyle}>
        <div style={comparisonHeaderStyle}>
          <h2 style={comparisonTitleStyle}>Compare Pro and Elite at a glance</h2>
          <p style={comparisonBodyStyle}>
            Pro is the best starting point for most active members. Elite is for members who want the highest-access
            tier and stronger long-term premium positioning.
          </p>
        </div>
        <div style={comparisonTableStyle}>
          <div style={comparisonHeadCellStyle}>Access</div>
          <div style={comparisonHeadCellStyle}>Free</div>
          <div style={comparisonFeaturedHeadCellStyle}>Pro</div>
          <div style={comparisonHeadCellStyle}>Elite</div>

          {planComparisonRows.map((row) => (
            <Fragment key={row.label}>
              <div style={comparisonLabelCellStyle}>{row.label}</div>
              <div style={comparisonCellStyle}>{row.free}</div>
              <div style={comparisonFeaturedCellStyle}>{row.pro}</div>
              <div style={comparisonCellStyle}>{row.elite}</div>
            </Fragment>
          ))}
        </div>
      </div>

      <TradingDisclaimer />

      <div style={faqCardStyle}>
        <h2 style={faqTitleStyle}>Common Questions</h2>
        <div style={faqListStyle}>
          {pricingQuestions.map((item) => (
            <article key={item.question} style={faqItemStyle}>
              <h3 style={faqQuestionStyle}>{item.question}</h3>
              <p style={faqAnswerStyle}>{item.answer}</p>
            </article>
          ))}
        </div>
        <div style={faqActionsStyle}>
          <Link to="/faq" style={secondarySupportLinkStyle}>
            Read full FAQ
          </Link>
          <Link to="/contact" style={primarySupportLinkStyle}>
            Contact support
          </Link>
        </div>
      </div>
    </section>
  );
}

const getTierState = (
  tierPlan: Tier["plan"],
  currentPlan: "free" | "pro" | "elite",
  isLoggedIn: boolean,
  isLoadingPlan: boolean
) => {
  if (isLoadingPlan) {
    return { kind: "status", label: "Checking plan" } as const;
  }

  if (tierPlan === currentPlan) {
    return { kind: "current", label: "Current Plan" } as const;
  }

  if ((currentPlan === "elite" && tierPlan === "pro") || (currentPlan === "pro" && tierPlan === "free")) {
    return { kind: "status", label: `Already on ${capitalizePlan(currentPlan)}` } as const;
  }

  if (currentPlan === "elite" && tierPlan === "free") {
    return { kind: "status", label: "Already on Elite" } as const;
  }

  if (tierPlan === "free") {
    return { kind: "link", label: "Start Free", to: "/signup" } as const;
  }

  if (isLoggedIn) {
    return {
      kind: "link",
      label: tierPlan === "pro" ? "Upgrade to Pro" : "Move to Elite",
      to: `/upgrade?plan=${tierPlan}`,
    } as const;
  }

  return {
    kind: "link",
    label: tierPlan === "pro" ? "Get Pro" : "Choose Elite",
    to: `/signup?plan=${tierPlan}`,
  } as const;
};

const capitalizePlan = (plan: string) => `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`;

const pageStyle = {
  display: "grid",
  gap: "1.5rem",
  padding: "2rem 0",
};

const heroStyle = {
  padding: "2rem",
  border: "1px solid #d0d5dd",
  borderRadius: "24px",
  background:
    "linear-gradient(135deg, rgba(16,24,40,1) 0%, rgba(29,41,57,1) 60%, rgba(71,84,103,1) 100%)",
  color: "#ffffff",
  display: "grid",
  gap: "0.75rem",
};

const heroEyebrowStyle = {
  margin: 0,
  color: "#d0d5dd",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  fontSize: "0.85rem",
};

const heroTitleStyle = {
  margin: 0,
  fontSize: "2.5rem",
  color: "#ffffff",
};

const heroBodyStyle = {
  margin: 0,
  maxWidth: "760px",
  color: "#eaecf0",
  lineHeight: 1.7,
};

const heroNoteStyle = {
  margin: 0,
  maxWidth: "760px",
  color: "#d0d5dd",
  lineHeight: 1.6,
};

const heroCurrentPlanStyle = {
  margin: "0.5rem 0 0",
  color: "#ffffff",
};

const heroActionsStyle = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap" as const,
  marginTop: "0.25rem",
};

const heroPrimaryLinkStyle = {
  textDecoration: "none",
  padding: "0.95rem 1.2rem",
  borderRadius: "12px",
  backgroundColor: "#ffffff",
  color: "#101828",
  fontWeight: 700,
};

const heroSecondaryLinkStyle = {
  textDecoration: "none",
  padding: "0.95rem 1.2rem",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.25)",
  backgroundColor: "transparent",
  color: "#ffffff",
  fontWeight: 700,
};

const tiersGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};

const tierCardStyle = (isFeatured: boolean) => ({
  display: "grid",
  gap: "1rem",
  padding: "1.5rem",
  borderRadius: "20px",
  border: isFeatured ? "1px solid #101828" : "1px solid #d0d5dd",
  backgroundColor: isFeatured ? "#f8fafc" : "#ffffff",
  boxShadow: isFeatured ? "0 8px 24px rgba(16, 24, 40, 0.08)" : "none",
});

const tierHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const tierHeadingBlockStyle = {
  display: "grid",
  gap: "0.3rem",
};

const tierKickerStyle = {
  color: "#667085",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
};

const tierTitleStyle = {
  margin: 0,
  color: "#101828",
};

const tierPriceBlockStyle = {
  display: "grid",
  gap: "0.45rem",
};

const tierPriceStyle = {
  fontSize: "2rem",
  color: "#101828",
};

const tierDescriptionStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.65,
};

const tierBestForStyle = {
  margin: 0,
  color: "#667085",
  lineHeight: 1.6,
};

const tierFeatureListStyle = {
  display: "grid",
  gap: "0.65rem",
};

const tierFeatureRowStyle = {
  display: "flex",
  gap: "0.6rem",
  color: "#344054",
};

const tierFeatureIconStyle = {
  fontWeight: 700,
};

const ctaStyle = (isFeatured: boolean) => ({
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "0.9rem 1.2rem",
  borderRadius: "12px",
  backgroundColor: isFeatured ? "#101828" : "#ffffff",
  color: isFeatured ? "#ffffff" : "#101828",
  border: isFeatured ? "1px solid #101828" : "1px solid #d0d5dd",
  fontWeight: 700,
});

const statusPillStyle = (isCurrent: boolean) => ({
  textAlign: "center" as const,
  padding: "0.9rem 1.2rem",
  borderRadius: "12px",
  backgroundColor: isCurrent ? "#ecfdf3" : "#f2f4f7",
  color: isCurrent ? "#027a48" : "#344054",
  border: isCurrent ? "1px solid #abefc6" : "1px solid #d0d5dd",
  fontWeight: 700,
});

const featuredPillStyle = {
  padding: "0.35rem 0.65rem",
  borderRadius: "999px",
  backgroundColor: "#101828",
  color: "#ffffff",
  fontSize: "0.75rem",
  fontWeight: 700,
  height: "fit-content",
};

const reassuranceGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};

const reassuranceCardStyle = {
  padding: "1.25rem",
  border: "1px solid #d0d5dd",
  borderRadius: "18px",
  backgroundColor: "#f8fafc",
  display: "grid",
  gap: "0.5rem",
};

const reassuranceTitleStyle = {
  margin: 0,
  color: "#101828",
  fontSize: "1.1rem",
};

const reassuranceBodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.7,
};

const rulesCardStyle = {
  padding: "1.5rem",
  border: "1px solid #d0d5dd",
  borderRadius: "20px",
  backgroundColor: "#f8fafc",
  display: "grid",
  gap: "0.5rem",
};

const rulesTitleStyle = {
  margin: 0,
  color: "#101828",
};

const rulesBodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.7,
};

const rulesNoteStyle = {
  margin: 0,
  color: "#667085",
  lineHeight: 1.6,
};

const comparisonSectionStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.5rem",
  border: "1px solid #d0d5dd",
  borderRadius: "20px",
  backgroundColor: "#ffffff",
};

const comparisonHeaderStyle = {
  display: "grid",
  gap: "0.45rem",
};

const comparisonTitleStyle = {
  margin: 0,
  color: "#101828",
};

const comparisonBodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.7,
  maxWidth: "760px",
};

const comparisonTableStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1.6fr) repeat(3, minmax(110px, 1fr))",
  border: "1px solid #eaecf0",
  borderRadius: "18px",
  overflow: "hidden",
};

const comparisonHeadCellStyle = {
  padding: "0.95rem 1rem",
  backgroundColor: "#f8fafc",
  borderBottom: "1px solid #eaecf0",
  color: "#475467",
  fontWeight: 700,
};

const comparisonFeaturedHeadCellStyle = {
  ...comparisonHeadCellStyle,
  backgroundColor: "#101828",
  color: "#ffffff",
};

const comparisonLabelCellStyle = {
  padding: "0.95rem 1rem",
  borderBottom: "1px solid #eaecf0",
  color: "#101828",
  fontWeight: 600,
  backgroundColor: "#ffffff",
};

const comparisonCellStyle = {
  padding: "0.95rem 1rem",
  borderBottom: "1px solid #eaecf0",
  color: "#475467",
  backgroundColor: "#ffffff",
};

const comparisonFeaturedCellStyle = {
  ...comparisonCellStyle,
  backgroundColor: "#f8fafc",
  color: "#101828",
  fontWeight: 600,
};

const faqCardStyle = {
  padding: "1.5rem",
  border: "1px solid #d0d5dd",
  borderRadius: "20px",
  backgroundColor: "#ffffff",
  display: "grid",
  gap: "0.85rem",
};

const faqTitleStyle = {
  margin: 0,
  color: "#101828",
};

const faqListStyle = {
  display: "grid",
  gap: "0.85rem",
};

const faqItemStyle = {
  display: "grid",
  gap: "0.35rem",
  padding: "1rem",
  borderRadius: "16px",
  border: "1px solid #eaecf0",
  backgroundColor: "#f8fafc",
};

const faqQuestionStyle = {
  margin: 0,
  color: "#101828",
  fontSize: "1rem",
};

const faqAnswerStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.7,
};

const faqActionsStyle = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap" as const,
};

const primarySupportLinkStyle = {
  textDecoration: "none",
  padding: "0.9rem 1.1rem",
  borderRadius: "12px",
  backgroundColor: "#101828",
  color: "#ffffff",
  fontWeight: 700,
};

const secondarySupportLinkStyle = {
  textDecoration: "none",
  padding: "0.9rem 1.1rem",
  borderRadius: "12px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  color: "#344054",
  fontWeight: 700,
};

export default PricingPage;

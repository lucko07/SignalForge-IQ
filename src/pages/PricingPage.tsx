import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { getUserProfile } from "../lib/firestore";
import type { UserPlan } from "../lib/firestore";

type Tier = {
  name: "Free" | "Pro" | "Elite";
  plan: "free" | "pro" | "elite";
  price: string;
  description: string;
  features: string[];
  featured: boolean;
};

const pricingTiers: Tier[] = [
  {
    name: "Free",
    plan: "free",
    price: "$0",
    description: "Public preview access for visitors and new users.",
    features: [
      "Public signal preview only",
      "Up to 3 recent signals on /signals",
      "No protected dashboard access",
    ],
    featured: false,
  },
  {
    name: "Pro",
    plan: "pro",
    price: "$49",
    description: "Full member access for active traders.",
    features: [
      "Full protected dashboard",
      "Live approved signals",
      "Closed trade history",
      "Performance summary",
    ],
    featured: true,
  },
  {
    name: "Elite",
    plan: "elite",
    price: "$99",
    description: "Everything in Pro, with room for future premium releases.",
    features: [
      "Everything in Pro",
      "Future premium feature access",
      "Premium-ready account tier",
    ],
    featured: false,
  },
];

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
    <section style={{ display: "grid", gap: "1.5rem", padding: "2rem 0" }}>
      <div
        style={{
          padding: "2rem",
          border: "1px solid #d0d5dd",
          borderRadius: "24px",
          background:
            "linear-gradient(135deg, rgba(16,24,40,1) 0%, rgba(29,41,57,1) 60%, rgba(71,84,103,1) 100%)",
          color: "#ffffff",
        }}
      >
        <p
          style={{
            margin: "0 0 0.75rem",
            color: "#d0d5dd",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontSize: "0.85rem",
          }}
        >
          Membership Access
        </p>
        <h1 style={{ margin: "0 0 1rem", fontSize: "2.5rem" }}>Pricing</h1>
        <p style={{ margin: 0, maxWidth: "720px", color: "#eaecf0" }}>
          Free users can explore the public preview. Pro and Elite unlock the
          protected dashboard, live signals, history, and performance tracking.
        </p>
        {isLoggedIn && !isLoadingPlan ? (
          <p style={{ margin: "1rem 0 0", color: "#ffffff" }}>
            Current plan: <strong>{currentPlan}</strong>
          </p>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        {pricingTiers.map((tier) => {
          const tierState = getTierState(tier.plan, effectivePlan, isLoggedIn, isLoadingPlan);

          return (
            <article
              key={tier.name}
              style={{
                display: "grid",
                gap: "1rem",
                padding: "1.5rem",
                borderRadius: "20px",
                border: tier.featured ? "1px solid #101828" : "1px solid #d0d5dd",
                backgroundColor: tier.featured ? "#f8fafc" : "#ffffff",
                boxShadow: tier.featured ? "0 8px 24px rgba(16, 24, 40, 0.08)" : "none",
              }}
            >
              <div style={{ display: "grid", gap: "0.4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                  <h2 style={{ margin: 0, color: "#101828" }}>{tier.name}</h2>
                  {tier.featured ? <span style={featuredPillStyle}>Most Popular</span> : null}
                </div>
                <strong style={{ fontSize: "2rem", color: "#101828" }}>{tier.price}</strong>
                <p style={{ margin: 0, color: "#475467" }}>{tier.description}</p>
              </div>

              <div style={{ display: "grid", gap: "0.65rem" }}>
                {tier.features.map((feature) => (
                  <div key={feature} style={{ display: "flex", gap: "0.6rem", color: "#344054" }}>
                    <span aria-hidden="true" style={{ fontWeight: 700 }}>
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

      <div
        style={{
          padding: "1.5rem",
          border: "1px solid #d0d5dd",
          borderRadius: "20px",
          backgroundColor: "#f8fafc",
          display: "grid",
          gap: "0.5rem",
        }}
      >
        <h2 style={{ margin: 0, color: "#101828" }}>Access Rules</h2>
        <p style={{ margin: 0, color: "#475467" }}>
          Free users can access public pages. Pro and Elite members unlock the full dashboard experience.
        </p>
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
    return { kind: "link", label: `Upgrade to ${capitalizePlan(tierPlan)}`, to: `/upgrade?plan=${tierPlan}` } as const;
  }

  return { kind: "link", label: `Upgrade to ${capitalizePlan(tierPlan)}`, to: `/signup?plan=${tierPlan}` } as const;
};

const capitalizePlan = (plan: string) => `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`;

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
};

export default PricingPage;

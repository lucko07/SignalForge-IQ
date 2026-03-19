import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { getUserProfile } from "../lib/firestore";
import type { UserPlan } from "../lib/firestore";

function UpgradeSuccessPage() {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [currentPlan, setCurrentPlan] = useState<UserPlan>("free");
  const [billingStatus, setBillingStatus] = useState("");
  const requestedPlan = searchParams.get("plan") === "elite" ? "elite" : "pro";

  useEffect(() => {
    let isMounted = true;
    let attempts = 0;

    const pollProfile = async () => {
      if (!currentUser) {
        return;
      }

      try {
        const profile = await getUserProfile(currentUser.uid);

        if (!isMounted) {
          return;
        }

        setCurrentPlan(profile?.plan ?? "free");
        setBillingStatus(profile?.billingStatus ?? "");

        if ((profile?.plan ?? "free") === requestedPlan || attempts >= 10) {
          return;
        }
      } finally {
        attempts += 1;
        if (isMounted && attempts <= 10) {
          window.setTimeout(() => {
            void pollProfile();
          }, 3000);
        }
      }
    };

    void pollProfile();

    return () => {
      isMounted = false;
    };
  }, [currentUser, requestedPlan]);

  const accessUpdated = currentPlan === requestedPlan;

  return (
    <section style={{ maxWidth: "720px", margin: "0 auto", display: "grid", gap: "1rem" }}>
      <div style={heroCardStyle}>
        <h1 style={{ margin: 0 }}>Checkout complete</h1>
        <p style={{ margin: 0, color: "#475467" }}>
          Your payment was completed successfully. Your access updates as soon as the
          subscription confirmation finishes syncing.
        </p>
      </div>

      <div style={contentCardStyle}>
        <p style={{ margin: 0 }}>
          <strong>Requested plan:</strong> {requestedPlan}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Current plan:</strong> {currentPlan}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Billing status:</strong> {billingStatus || "Pending confirmation"}
        </p>

        {accessUpdated ? (
          <div style={successBannerStyle}>
            Your account now has {requestedPlan} access. You can open the dashboard now.
          </div>
        ) : (
          <div style={noticeBannerStyle}>
            Payment was successful, but plan access is still syncing. This usually resolves
            within a few seconds after confirmation is processed.
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link to="/dashboard" style={primaryLinkStyle}>
            Open dashboard
          </Link>
          <Link to="/pricing" style={secondaryLinkStyle}>
            Back to pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

const heroCardStyle = {
  padding: "1.5rem",
  border: "1px solid #d0d5dd",
  borderRadius: "20px",
  backgroundColor: "#f8fafc",
  display: "grid",
  gap: "0.5rem",
};

const contentCardStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.5rem",
  border: "1px solid #d0d5dd",
  borderRadius: "20px",
  backgroundColor: "#ffffff",
};

const successBannerStyle = {
  padding: "0.9rem 1rem",
  borderRadius: "14px",
  backgroundColor: "#ecfdf3",
  color: "#027a48",
  border: "1px solid #abefc6",
  fontWeight: 700,
};

const noticeBannerStyle = {
  padding: "0.9rem 1rem",
  borderRadius: "14px",
  backgroundColor: "#eff8ff",
  color: "#175cd3",
  border: "1px solid #b2ddff",
};

const primaryLinkStyle = {
  textDecoration: "none",
  padding: "0.9rem 1.1rem",
  borderRadius: "12px",
  backgroundColor: "#101828",
  color: "#ffffff",
  fontWeight: 700,
};

const secondaryLinkStyle = {
  textDecoration: "none",
  padding: "0.9rem 1.1rem",
  borderRadius: "12px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  color: "#344054",
  fontWeight: 700,
};

export default UpgradeSuccessPage;

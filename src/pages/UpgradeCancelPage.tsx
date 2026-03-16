import { Link, useSearchParams } from "react-router-dom";

function UpgradeCancelPage() {
  const [searchParams] = useSearchParams();
  const requestedPlan = searchParams.get("plan") === "elite" ? "elite" : "pro";

  return (
    <section style={{ maxWidth: "720px", margin: "0 auto", display: "grid", gap: "1rem" }}>
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
        <h1 style={{ margin: 0 }}>Checkout canceled</h1>
        <p style={{ margin: 0, color: "#475467" }}>
          Your {requestedPlan} upgrade was canceled before payment completed. No plan
          changes were made.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          padding: "1.5rem",
          border: "1px solid #d0d5dd",
          borderRadius: "20px",
          backgroundColor: "#ffffff",
        }}
      >
        <p style={{ margin: 0, color: "#475467" }}>
          You can return to pricing, review the plan details again, and restart checkout
          whenever you are ready.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link to={`/upgrade?plan=${requestedPlan}`} style={primaryLinkStyle}>
            Return to upgrade
          </Link>
          <Link to="/pricing" style={secondaryLinkStyle}>
            Back to pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

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

export default UpgradeCancelPage;

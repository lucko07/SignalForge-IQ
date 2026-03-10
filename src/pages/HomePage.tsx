import { Link } from "react-router-dom";

function HomePage() {
  return (
    <section
      style={{
        padding: "3rem 0",
        display: "grid",
        gap: "1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: "720px",
          padding: "2rem",
          border: "1px solid #d6d9e0",
          borderRadius: "24px",
          backgroundColor: "#f8fafc",
        }}
      >
        <p
          style={{
            margin: "0 0 0.75rem",
            color: "#475467",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontSize: "0.85rem",
          }}
        >
          Trading platform foundation
        </p>
        <h1 style={{ margin: "0 0 1rem", fontSize: "2.8rem", color: "#101828" }}>
          Build your SignalForge IQ experience from a clean starting point.
        </h1>
        <p style={{ margin: "0 0 1.5rem", fontSize: "1.05rem", color: "#475467" }}>
          This base site gives you a clear landing page, clickable navigation, and
          route-ready placeholder sections for pricing, signals, education, support,
          and account access.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link
            to="/signup"
            style={{
              textDecoration: "none",
              backgroundColor: "#101828",
              color: "#ffffff",
              padding: "0.9rem 1.2rem",
              borderRadius: "12px",
              fontWeight: 700,
            }}
          >
            Create your account
          </Link>
          <Link
            to="/pricing"
            style={{
              textDecoration: "none",
              backgroundColor: "#ffffff",
              color: "#101828",
              padding: "0.9rem 1.2rem",
              borderRadius: "12px",
              border: "1px solid #d0d5dd",
              fontWeight: 700,
            }}
          >
            View pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

export default HomePage;

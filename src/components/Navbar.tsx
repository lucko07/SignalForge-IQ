import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { signOut } from "../lib/auth";
import { normalizeManagedPlan } from "../lib/userProfiles";
import BrandLogo from "./BrandLogo";
import ThemeToggle from "./ThemeToggle";
import TranslateControl from "./TranslateControl";

const publicNavItems = [
  { label: "Home", to: "/" },
  { label: "Pricing", to: "/pricing" },
  { label: "Signals", to: "/signals" },
  { label: "Education", to: "/education" },
  { label: "FAQ", to: "/faq" },
  { label: "Contact", to: "/contact" },
] as const;

function Navbar() {
  const navigate = useNavigate();
  const { currentUser, loading, profile, isAdmin, hasSubscriptionAccess } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await signOut();
      navigate("/", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isSignedIn = !!currentUser;
  const showAdminLink = isSignedIn && isAdmin;
  const showDashboardLink = isSignedIn;
  const showAutomationLink = isSignedIn && (isAdmin || hasSubscriptionAccess);
  const accountLabel = isAdmin
    ? "Administrator"
    : hasSubscriptionAccess
      ? `${capitalizePlan(normalizeManagedPlan(profile?.currentPlan ?? profile?.plan ?? "free"))} member`
      : "Free account";

  return (
    <header
      style={{
        borderBottom: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface)",
        position: "sticky",
        top: 0,
        zIndex: 10,
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "1rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={brandClusterStyle}>
          <BrandLogo variant="compact" />
        </div>

        <div style={rightClusterStyle}>
          <nav
            aria-label="Primary"
            style={navStyle}
          >
            {publicNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => navLinkStyle(isActive)}
              >
                {item.label}
              </NavLink>
            ))}

            {!isSignedIn && !loading ? (
              <>
                <NavLink to="/login" style={({ isActive }) => navLinkStyle(isActive)}>
                  Login
                </NavLink>
                <NavLink to="/signup" style={({ isActive }) => navLinkStyle(isActive)}>
                  Signup
                </NavLink>
              </>
            ) : null}

            {isSignedIn ? (
              <>
                {showDashboardLink ? (
                  <NavLink to="/dashboard" style={({ isActive }) => navLinkStyle(isActive)}>
                    Dashboard
                  </NavLink>
                ) : null}
                {showAutomationLink ? (
                  <NavLink to="/dashboard/automation" style={({ isActive }) => navLinkStyle(isActive)}>
                    Automation
                  </NavLink>
                ) : null}
                {showAdminLink ? (
                  <>
                    <NavLink to="/admin/signals" style={({ isActive }) => navLinkStyle(isActive)}>
                      Review
                    </NavLink>
                    <NavLink to="/admin/executions" style={({ isActive }) => navLinkStyle(isActive)}>
                      Audit
                    </NavLink>
                  </>
                ) : null}
              </>
            ) : null}
          </nav>

          <div style={utilityClusterStyle}>
            <TranslateControl />
            <ThemeToggle />
          </div>

          {isSignedIn ? (
            <>
              <span style={accountPillStyle}>
                {loading ? "Account" : accountLabel}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                style={logoutButtonStyle(isLoggingOut)}
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

const navLinkStyle = (isActive: boolean) => ({
  textDecoration: "none",
  color: isActive ? "var(--color-nav-chip-active-text)" : "var(--color-button-secondary-text)",
  backgroundColor: isActive ? "var(--color-nav-chip-active)" : "var(--color-nav-chip)",
  padding: "0.55rem 0.9rem",
  borderRadius: "999px",
  fontSize: "0.95rem",
  fontWeight: 600,
});

const rightClusterStyle = {
  display: "flex",
  flex: "1 1 520px",
  minWidth: 0,
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "0.65rem",
  flexWrap: "wrap" as const,
};

const brandClusterStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  flexShrink: 0,
  minHeight: "40px",
};

const navStyle = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap" as const,
};

const utilityClusterStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  flexWrap: "wrap" as const,
};

const accountPillStyle = {
  padding: "0.55rem 0.9rem",
  borderRadius: "999px",
  backgroundColor: "var(--color-success-bg)",
  color: "var(--color-success-text)",
  fontSize: "0.9rem",
  fontWeight: 700,
};

const logoutButtonStyle = (isDisabled: boolean) => ({
  border: "1px solid var(--color-border-strong)",
  borderRadius: "999px",
  padding: "0.55rem 0.9rem",
  backgroundColor: "var(--color-surface)",
  color: "var(--color-button-secondary-text)",
  fontSize: "0.95rem",
  fontWeight: 600,
  cursor: isDisabled ? "not-allowed" : "pointer",
  opacity: isDisabled ? 0.72 : 1,
});

const capitalizePlan = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

export default Navbar;

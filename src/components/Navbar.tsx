import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { logout } from "../lib/auth";
import { getUserProfile } from "../lib/firestore";
import type { UserPlan, UserRole } from "../lib/firestore";

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
  const { currentUser, loading } = useAuth();
  const [plan, setPlan] = useState<UserPlan>("free");
  const [role, setRole] = useState<UserRole>("member");
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (!currentUser) {
        if (isMounted) {
          setPlan("free");
          setRole("member");
          setIsProfileLoading(false);
        }

        return;
      }

      setIsProfileLoading(true);

      try {
        const profile = await getUserProfile(currentUser.uid);

        if (isMounted) {
          setPlan(profile?.plan ?? "free");
          setRole(profile?.role ?? "member");
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

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logout();
      navigate("/", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isSignedIn = !!currentUser;
  const showAdminLink = isSignedIn && role === "admin";
  const accountLabel = role === "admin" ? "Account" : capitalizePlan(plan);

  return (
    <header
      style={{
        borderBottom: "1px solid #d6d9e0",
        backgroundColor: "#ffffff",
        position: "sticky",
        top: 0,
        zIndex: 10,
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
        <NavLink
          to="/"
          style={{
            textDecoration: "none",
            color: "#101828",
            fontSize: "1.25rem",
            fontWeight: 700,
          }}
        >
          SignalForge IQ
        </NavLink>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <nav
            aria-label="Primary"
            style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}
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
                <NavLink to="/dashboard" style={({ isActive }) => navLinkStyle(isActive)}>
                  Dashboard
                </NavLink>
                {showAdminLink ? (
                  <NavLink to="/admin/signals" style={({ isActive }) => navLinkStyle(isActive)}>
                    Review
                  </NavLink>
                ) : null}
              </>
            ) : null}
          </nav>

          {isSignedIn ? (
            <>
              <span style={accountPillStyle}>
                {isProfileLoading ? "Account" : accountLabel}
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
  color: isActive ? "#ffffff" : "#344054",
  backgroundColor: isActive ? "#101828" : "#f2f4f7",
  padding: "0.55rem 0.9rem",
  borderRadius: "999px",
  fontSize: "0.95rem",
  fontWeight: 600,
});

const accountPillStyle = {
  padding: "0.55rem 0.9rem",
  borderRadius: "999px",
  backgroundColor: "#ecfdf3",
  color: "#027a48",
  fontSize: "0.9rem",
  fontWeight: 700,
};

const logoutButtonStyle = (isDisabled: boolean) => ({
  border: "1px solid #d0d5dd",
  borderRadius: "999px",
  padding: "0.55rem 0.9rem",
  backgroundColor: "#ffffff",
  color: "#344054",
  fontSize: "0.95rem",
  fontWeight: 600,
  cursor: isDisabled ? "not-allowed" : "pointer",
});

const capitalizePlan = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

export default Navbar;

import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/auth-context";

type ProtectedRouteProps = {
  children: ReactNode;
  requireAdmin?: boolean;
  requireSubscription?: boolean;
  requireLegalConsent?: boolean;
  redirectTo?: string;
};

function ProtectedRoute({
  children,
  requireAdmin = false,
  requireSubscription = false,
  requireLegalConsent = false,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const location = useLocation();
  const { currentUser, loading, isAdmin, hasSubscriptionAccess, hasLegalConsent } = useAuth();

  if (loading) {
    return <div style={{ padding: "2rem 0" }}>Checking your access...</div>;
  }

  if (!currentUser) {
    const nextPath = `${location.pathname}${location.search}${location.hash}`;
    const redirectTarget = redirectTo.startsWith("/login")
      ? `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}next=${encodeURIComponent(nextPath)}`
      : redirectTo;
    return <Navigate to={redirectTarget} replace />;
  }

  if (requireLegalConsent && !hasLegalConsent) {
    // Legal consent is enforced from Firestore-backed profile state, not local UI state.
    const nextPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/legal-consent?next=${encodeURIComponent(nextPath)}`} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireSubscription && !hasSubscriptionAccess) {
    return <Navigate to="/pricing" replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;

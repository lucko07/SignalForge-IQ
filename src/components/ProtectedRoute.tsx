import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../context/auth-context";
import { getUserProfile, hasActiveBillingAccess } from "../lib/firestore";
import type { UserPlan, UserRole, UserProfile } from "../lib/firestore";

type ProtectedRouteProps = {
  children: ReactNode;
  requireAdmin?: boolean;
  requirePaidPlan?: boolean;
  redirectTo?: string;
};

function ProtectedRoute({
  children,
  requireAdmin = false,
  requirePaidPlan = false,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const { currentUser, loading } = useAuth();
  const [isProfileLoading, setIsProfileLoading] = useState(requireAdmin || requirePaidPlan);
  const [profileRole, setProfileRole] = useState<UserRole>("member");
  const [profilePlan, setProfilePlan] = useState<UserPlan>("free");
  const [billingStatus, setBillingStatus] = useState<UserProfile["billingStatus"]>(undefined);

  useEffect(() => {
    let isMounted = true;

    const resetProfileState = () => {
      setProfileRole("member");
      setProfilePlan("free");
      setBillingStatus(undefined);
    };

    const checkAccessProfile = async () => {
      if (!requireAdmin && !requirePaidPlan) {
        setIsProfileLoading(false);
        resetProfileState();
        return;
      }

      if (!currentUser) {
        resetProfileState();
        setIsProfileLoading(false);
        return;
      }

      setIsProfileLoading(true);

      try {
        const userProfile = await getUserProfile(currentUser.uid);

        if (isMounted) {
          setProfileRole(userProfile?.role ?? "member");
          setProfilePlan(userProfile?.plan ?? "free");
          setBillingStatus(userProfile?.billingStatus);
        }
      } catch {
        if (isMounted) {
          resetProfileState();
        }
      } finally {
        if (isMounted) {
          setIsProfileLoading(false);
        }
      }
    };

    void checkAccessProfile();

    return () => {
      isMounted = false;
    };
  }, [currentUser, requireAdmin, requirePaidPlan]);

  const hasAdminAccess = profileRole === "admin";
  const hasPaidAccess = hasActiveBillingAccess({
    plan: profilePlan,
    role: profileRole,
    billingStatus,
  });

  if (loading || isProfileLoading) {
    return <div style={{ padding: "2rem 0" }}>Checking your access...</div>;
  }

  if (!currentUser) {
    return <Navigate to={redirectTo} replace />;
  }

  if (requireAdmin && !hasAdminAccess) {
    return <Navigate to={hasPaidAccess ? "/dashboard" : "/pricing"} replace />;
  }

  if (requirePaidPlan && !hasPaidAccess) {
    return <Navigate to="/pricing" replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;

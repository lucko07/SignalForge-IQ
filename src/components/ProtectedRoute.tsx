import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthProvider";
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
  const [checkedProfileUid, setCheckedProfileUid] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkAccessProfile = async () => {
      if (!requireAdmin && !requirePaidPlan) {
        setIsProfileLoading(false);
        setProfileRole("member");
        setProfilePlan("free");
        setBillingStatus(undefined);
        setCheckedProfileUid(null);
        return;
      }

      if (!currentUser) {
        setProfileRole("member");
        setProfilePlan("free");
        setBillingStatus(undefined);
        setIsProfileLoading(false);
        setCheckedProfileUid(null);
        return;
      }

      setIsProfileLoading(true);
      setCheckedProfileUid(null);

      try {
        const userProfile = await getUserProfile(currentUser.uid);

        if (isMounted) {
          setProfileRole(userProfile?.role ?? "member");
          setProfilePlan(userProfile?.plan ?? "free");
          setBillingStatus(userProfile?.billingStatus);
          setCheckedProfileUid(currentUser.uid);
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

  const isProfileCheckPending =
    (requireAdmin || requirePaidPlan) && !!currentUser && checkedProfileUid !== currentUser.uid;
  const hasAdminAccess = profileRole === "admin";
  const hasPaidAccess = hasActiveBillingAccess({
    plan: profilePlan,
    role: profileRole,
    billingStatus,
  });

  if (loading || isProfileLoading || isProfileCheckPending) {
    return <div style={{ padding: "2rem 0" }}>Checking your session...</div>;
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

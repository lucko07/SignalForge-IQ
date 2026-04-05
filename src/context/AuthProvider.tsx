import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, hasRequiredFirebaseClientConfig } from "../lib/firebase";
import type { UserProfile } from "../lib/userProfiles";
import {
  getOrCreateUserProfile,
  hasAcceptedLegal,
  hasSubscriptionAccess,
} from "../lib/userProfiles";
import { AuthContext } from "./auth-context";

type AuthProviderProps = {
  children: ReactNode;
};

function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(hasRequiredFirebaseClientConfig);

  const refreshProfile = async () => {
    if (!auth.currentUser) {
      setProfile(null);
      return;
    }

    const nextProfile = await getOrCreateUserProfile(auth.currentUser);
    setProfile(nextProfile);
  };

  useEffect(() => {
    if (!hasRequiredFirebaseClientConfig) {
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const nextProfile = await getOrCreateUserProfile(user);
        setProfile(nextProfile);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profile,
        loading,
        isAuthenticated: Boolean(currentUser),
        isAdmin: profile?.role === "admin",
        hasSubscriptionAccess: hasSubscriptionAccess(profile),
        hasLegalConsent: hasAcceptedLegal(profile),
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;

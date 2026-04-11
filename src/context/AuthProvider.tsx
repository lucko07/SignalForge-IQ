import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth, hasRequiredFirebaseClientConfig } from "../lib/firebase";
import type { UserProfile } from "../lib/userProfiles";
import {
  getOrCreateUserProfile,
  hasAcceptedLegal,
  hasEliteAccess,
  hasProAccess,
  hasSubscriptionAccess,
  canUseAutomation,
} from "../lib/userProfiles";
import { AuthContext } from "./auth-context";

type AuthProviderProps = {
  children: ReactNode;
};

function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<typeof auth.currentUser>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(hasRequiredFirebaseClientConfig);

  const refreshProfile = async () => {
    if (!auth.currentUser) {
      setProfile(null);
      return;
    }

    try {
      const nextProfile = await getOrCreateUserProfile(auth.currentUser);
      setProfile(nextProfile);
    } catch (error) {
      throw error;
    }
  };

  useEffect(() => {
    if (!hasRequiredFirebaseClientConfig) {
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const nextProfile = await getOrCreateUserProfile(user);
        setCurrentUser(user);
        setProfile(nextProfile);
      } catch (error) {
        setCurrentUser(null);
        setProfile(null);
        await firebaseSignOut(auth).catch(() => undefined);
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
        hasProAccess: hasProAccess(profile),
        hasEliteAccess: hasEliteAccess(profile),
        canAccessAutomation: canUseAutomation(profile),
        hasLegalConsent: hasAcceptedLegal(profile),
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;

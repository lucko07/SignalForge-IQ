import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth, hasRequiredFirebaseClientConfig } from "../lib/firebase";
import type { UserProfile } from "../lib/userProfiles";
import {
  getOrCreateUserProfile,
  getUserProfile,
  hasAcceptedLegal,
  hasEliteAccess,
  hasProAccess,
  hasSubscriptionAccess,
  canUseAutomation,
} from "../lib/userProfiles";
import { AuthContext } from "./auth-context";
import { reloadCurrentUser } from "../lib/auth";

type AuthProviderProps = {
  children: ReactNode;
};

function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<typeof auth.currentUser>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(hasRequiredFirebaseClientConfig);

  const syncAuthenticatedState = async () => {
    const reloadedUser = await reloadCurrentUser().catch(() => auth.currentUser);
    const activeUser = reloadedUser ?? auth.currentUser;

    if (!activeUser) {
      setCurrentUser(null);
      setProfile(null);
      return;
    }

    const nextProfile = await getOrCreateUserProfile(activeUser, { repairExisting: false });
    setCurrentUser(activeUser);
    setProfile(nextProfile);
  };

  const refreshProfile = async () => {
    await syncAuthenticatedState();
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
        const reloadedUser = await reloadCurrentUser().catch(() => user);
        const activeUser = reloadedUser ?? auth.currentUser ?? user;

        if (import.meta.env.DEV) {
          console.info("[auth-provider] auth success", {
            uid: activeUser.uid,
            email: activeUser.email,
            emailVerified: activeUser.emailVerified,
          });
          console.info("[auth-provider] profile read start", {
            uid: activeUser.uid,
          });
        }

        const nextProfile = await getOrCreateUserProfile(activeUser, { repairExisting: false });

        if (import.meta.env.DEV) {
          console.info("[auth-provider] profile read success", {
            uid: activeUser.uid,
          });
        }

        setCurrentUser(activeUser);
        setProfile(nextProfile);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("[auth-provider] profile bootstrap failed", error);
        }

        try {
          const fallbackProfile = await getUserProfile(user.uid);

          if (fallbackProfile) {
            if (import.meta.env.DEV) {
              console.info("[auth-provider] profile fallback read success", {
                uid: user.uid,
              });
            }

            setCurrentUser(user);
            setProfile(fallbackProfile);
          } else {
            if (import.meta.env.DEV) {
              console.error("[auth-provider] profile fallback missing", {
                uid: user.uid,
              });
            }
            setCurrentUser(null);
            setProfile(null);
            await firebaseSignOut(auth).catch(() => undefined);
          }
        } catch (fallbackError) {
          if (import.meta.env.DEV) {
            console.error("[auth-provider] profile fallback read failed", fallbackError);
          }
          setCurrentUser(null);
          setProfile(null);
          await firebaseSignOut(auth).catch(() => undefined);
        }
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
        isEmailVerified: currentUser?.emailVerified === true,
        isAdmin: profile?.role === "admin",
        hasSubscriptionAccess: hasSubscriptionAccess(profile),
        hasProAccess: hasProAccess(profile),
        hasEliteAccess: hasEliteAccess(profile),
        canAccessAutomation: canUseAutomation(profile),
        hasLegalConsent: hasAcceptedLegal(profile),
        refreshProfile,
        refreshAuthState: syncAuthenticatedState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;

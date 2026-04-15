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
      const nextProfile = await getOrCreateUserProfile(auth.currentUser, { repairExisting: false });
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
        if (import.meta.env.DEV) {
          console.info("[auth-provider] auth success", {
            uid: user.uid,
            email: user.email,
          });
          console.info("[auth-provider] profile read start", {
            uid: user.uid,
          });
        }

        const nextProfile = await getOrCreateUserProfile(user, { repairExisting: false });

        if (import.meta.env.DEV) {
          console.info("[auth-provider] profile read success", {
            uid: user.uid,
          });
        }

        setCurrentUser(user);
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

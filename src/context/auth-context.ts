import { createContext, useContext } from "react";
import type { User } from "firebase/auth";
import type { UserProfile } from "../lib/userProfiles";

export type AuthContextValue = {
  currentUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  isAdmin: boolean;
  hasSubscriptionAccess: boolean;
  hasProAccess: boolean;
  hasEliteAccess: boolean;
  canAccessAutomation: boolean;
  hasLegalConsent: boolean;
  refreshProfile: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
};

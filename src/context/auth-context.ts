import { createContext, useContext } from "react";
import type { User } from "firebase/auth";

export type AuthContextValue = {
  currentUser: User | null;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
};

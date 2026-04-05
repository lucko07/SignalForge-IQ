type LegalAcceptanceProfile = {
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
  termsVersion?: string;
};

export const CURRENT_TERMS_VERSION = "v1.0";

export function requireLegalAcceptance(user: LegalAcceptanceProfile) {
  if (
    user.termsAccepted !== true
    || user.privacyAccepted !== true
    || user.termsVersion !== CURRENT_TERMS_VERSION
  ) {
    throw new Error("Legal acceptance required");
  }
}

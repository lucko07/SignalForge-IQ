import { parseActionCodeURL } from "firebase/auth";
import type { ActionCodeSettings } from "firebase/auth";

const CANONICAL_APP_ORIGIN = "https://signalforgeiq.com";
const WWW_APP_ORIGIN = "https://www.signalforgeiq.com";

export const DEFAULT_AUTH_REDIRECT_PATH = "/dashboard";

export const emailVerificationActionSettings: ActionCodeSettings = {
  url: `${CANONICAL_APP_ORIGIN}/verify-email?next=${encodeURIComponent(DEFAULT_AUTH_REDIRECT_PATH)}`,
  handleCodeInApp: false,
};

export type EmailActionParams = {
  mode: string | null;
  normalizedMode: "verifyEmail" | null;
  oobCode: string | null;
  continueUrl: string | null;
  apiKey: string | null;
  lang: string | null;
  next: string | null;
};

const getRuntimeOrigin = () => {
  if (typeof window === "undefined") {
    return CANONICAL_APP_ORIGIN;
  }

  return window.location.origin;
};

const isAllowedOrigin = (origin: string) => {
  return (
    origin === getRuntimeOrigin()
    || origin === CANONICAL_APP_ORIGIN
    || origin === WWW_APP_ORIGIN
  );
};

const normalizeSafePath = (value: string, fallback: string) => {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  if (value === "/verify-email" || value.startsWith("/verify-email?")) {
    return fallback;
  }

  return value;
};

export const sanitizeRedirectPath = (
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT_PATH
) => {
  if (!value) {
    return fallback;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return fallback;
  }

  try {
    if (trimmedValue.startsWith("/")) {
      const parsedInternalUrl = new URL(trimmedValue, CANONICAL_APP_ORIGIN);
      return normalizeSafePath(
        `${parsedInternalUrl.pathname}${parsedInternalUrl.search}${parsedInternalUrl.hash}`,
        fallback
      );
    }

    const parsedUrl = new URL(trimmedValue);

    if (!isAllowedOrigin(parsedUrl.origin)) {
      return fallback;
    }

    return normalizeSafePath(
      `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`,
      fallback
    );
  } catch {
    return fallback;
  }
};

const getRedirectFromContinueUrl = (continueUrl: string | null | undefined) => {
  if (!continueUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(continueUrl, CANONICAL_APP_ORIGIN);
    const nextPath = sanitizeRedirectPath(parsedUrl.searchParams.get("next"), "");

    if (nextPath) {
      return nextPath;
    }

    const continuePath = sanitizeRedirectPath(
      `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`,
      ""
    );

    return continuePath || null;
  } catch {
    return null;
  }
};

const normalizeEmailActionMode = (mode: string | null) => {
  if (mode === "verifyEmail" || mode === "VERIFY_EMAIL") {
    return "verifyEmail";
  }

  return null;
};

export const getEmailActionParams = (href: string): EmailActionParams => {
  const parsedActionUrl = parseActionCodeURL(href);
  const currentUrl = new URL(href, CANONICAL_APP_ORIGIN);
  const mode = currentUrl.searchParams.get("mode") ?? parsedActionUrl?.operation ?? null;

  return {
    mode,
    normalizedMode: normalizeEmailActionMode(mode),
    oobCode: currentUrl.searchParams.get("oobCode") ?? parsedActionUrl?.code ?? null,
    continueUrl: currentUrl.searchParams.get("continueUrl") ?? parsedActionUrl?.continueUrl ?? null,
    apiKey: currentUrl.searchParams.get("apiKey") ?? parsedActionUrl?.apiKey ?? null,
    lang: currentUrl.searchParams.get("lang") ?? parsedActionUrl?.languageCode ?? null,
    next: currentUrl.searchParams.get("next"),
  };
};

export const hasEmailActionParams = (params: EmailActionParams) => {
  return Boolean(
    params.mode
    || params.oobCode
    || params.continueUrl
    || params.apiKey
    || params.lang
  );
};

export const getSafeRedirectTarget = ({
  next,
  continueUrl,
  fallback = DEFAULT_AUTH_REDIRECT_PATH,
}: {
  next?: string | null;
  continueUrl?: string | null;
  fallback?: string;
}) => {
  const explicitNext = sanitizeRedirectPath(next, "");

  if (explicitNext) {
    return explicitNext;
  }

  const nestedRedirect = getRedirectFromContinueUrl(continueUrl);

  if (nestedRedirect) {
    return nestedRedirect;
  }

  return sanitizeRedirectPath(fallback, DEFAULT_AUTH_REDIRECT_PATH);
};

import crypto from "node:crypto";

const BYPASS_COOKIE_NAME = "sfiq_maintenance_bypass";
const BYPASS_COOKIE_TTL_SECONDS = 60 * 60 * 8;
const BYPASS_COOKIE_SALT = "signalforge-iq-maintenance";

export function isMaintenanceModeEnabled() {
  return String(process.env.MAINTENANCE_MODE ?? "").trim().toLowerCase() === "true";
}

export function getMaintenanceBypassToken() {
  return String(process.env.MAINTENANCE_BYPASS_TOKEN ?? "").trim();
}

export function hasMaintenanceBypassToken() {
  return getMaintenanceBypassToken().length > 0;
}

export function hasValidMaintenanceBypass(req) {
  const token = getMaintenanceBypassToken();

  if (!token) {
    return false;
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieValue = cookies[BYPASS_COOKIE_NAME];

  if (!cookieValue) {
    return false;
  }

  return timingSafeEqual(cookieValue, createBypassSignature(token));
}

export function setMaintenanceBypassCookie(res) {
  const token = getMaintenanceBypassToken();

  if (!token) {
    return;
  }

  const cookieValue = createBypassSignature(token);
  res.setHeader(
    "Set-Cookie",
    `${BYPASS_COOKIE_NAME}=${cookieValue}; Max-Age=${BYPASS_COOKIE_TTL_SECONDS}; Path=/; HttpOnly; SameSite=Lax; Secure`
  );
}

export function clearMaintenanceBypassCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${BYPASS_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure`
  );
}

export function isValidMaintenanceBypassAttempt(token) {
  const expectedToken = getMaintenanceBypassToken();

  if (!expectedToken || !token) {
    return false;
  }

  return timingSafeEqual(token, expectedToken);
}

function createBypassSignature(token) {
  return crypto.createHmac("sha256", token).update(BYPASS_COOKIE_SALT).digest("hex");
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, part) => {
    const trimmedPart = part.trim();

    if (!trimmedPart) {
      return cookies;
    }

    const separatorIndex = trimmedPart.indexOf("=");

    if (separatorIndex === -1) {
      return cookies;
    }

    const key = trimmedPart.slice(0, separatorIndex).trim();
    const value = trimmedPart.slice(separatorIndex + 1).trim();

    if (key) {
      cookies[key] = value;
    }

    return cookies;
  }, {});
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

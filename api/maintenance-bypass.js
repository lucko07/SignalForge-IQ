import {
  isMaintenanceModeEnabled,
  isValidMaintenanceBypassAttempt,
  setMaintenanceBypassCookie,
} from "./_maintenance.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  const payload = parseBody(req.body);
  const token = typeof payload?.token === "string" ? payload.token.trim() : "";

  if (!isMaintenanceModeEnabled()) {
    return res.status(200).json({
      success: true,
      enabled: false,
    });
  }

  if (!isValidMaintenanceBypassAttempt(token)) {
    return res.status(401).json({
      success: false,
      error: "Invalid bypass token",
    });
  }

  setMaintenanceBypassCookie(res);

  return res.status(200).json({
    success: true,
    enabled: true,
    bypassed: true,
  });
}

function parseBody(body) {
  if (!body) {
    return null;
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }

  if (typeof body === "object") {
    return body;
  }

  return null;
}

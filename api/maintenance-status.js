import {
  clearMaintenanceBypassCookie,
  hasMaintenanceBypassToken,
  hasValidMaintenanceBypass,
  isMaintenanceModeEnabled,
} from "./_maintenance.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  const enabled = isMaintenanceModeEnabled();

  if (!enabled) {
    clearMaintenanceBypassCookie(res);
  }

  return res.status(200).json({
    success: true,
    enabled,
    bypassed: enabled ? hasValidMaintenanceBypass(req) : true,
    bypassAvailable: hasMaintenanceBypassToken(),
  });
}

export type MaintenanceStatus = {
  enabled: boolean;
  bypassed: boolean;
  bypassAvailable: boolean;
};

export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  const response = await fetch("/api/maintenance-status", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to load maintenance status.");
  }

  const payload = await response.json();

  return {
    enabled: Boolean(payload?.enabled),
    bypassed: Boolean(payload?.bypassed),
    bypassAvailable: Boolean(payload?.bypassAvailable),
  };
}

export async function activateMaintenanceBypass(token: string) {
  const response = await fetch("/api/maintenance-bypass", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new Error("Unable to activate maintenance bypass.");
  }

  return response.json();
}

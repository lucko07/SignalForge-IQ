export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  const payload = parseJsonBody(req.body);

  if (!payload) {
    console.warn("[tradingview-webhook] Invalid payload received", {
      contentType: req.headers["content-type"],
      bodyType: typeof req.body,
    });

    return res.status(400).json({
      success: false,
      error: "Invalid JSON payload",
    });
  }

  console.log("[tradingview-webhook] Incoming TradingView payload", payload);

  return res.status(200).json({
    success: true,
    message: "TradingView webhook received",
  });
}

function parseJsonBody(body) {
  if (!body) {
    return null;
  }

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  if (isPlainObject(body)) {
    return body;
  }

  return null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

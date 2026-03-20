const RATE_LIMIT_WINDOW_MS = Number(process.env.CONTACT_RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.CONTACT_RATE_LIMIT_MAX ?? 5);
const MAIL_SERVICE_URL = process.env.CONTACT_EMAIL_SERVICE_URL ?? "https://api.resend.com/emails";
const MAIL_SERVICE_KEY = process.env.CONTACT_EMAIL_API_KEY ?? "";
const MAIL_FROM = process.env.CONTACT_EMAIL_FROM ?? "";
const MAIL_TO = "support@signalforgeiq.com";

const rateLimitStore = new Map();

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false });
  }

  const clientIp = getClientIp(req);

  if (isRateLimited(clientIp)) {
    return res.status(429).json({ success: false });
  }

  if (!MAIL_SERVICE_KEY || !MAIL_FROM) {
    return res.status(500).json({ success: false });
  }

  const payload = parseBody(req.body);

  if (!payload) {
    return res.status(400).json({ success: false });
  }

  const sanitizedInput = sanitizeContactInput(payload);

  if (!isValidContactInput(sanitizedInput)) {
    return res.status(400).json({ success: false });
  }

  const emailSent = await sendContactEmail(sanitizedInput);

  if (!emailSent) {
    return res.status(500).json({ success: false });
  }

  return res.status(200).json({ success: true });
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

function sanitizeContactInput(payload) {
  return {
    name: sanitizeText(payload.name, 120),
    email: sanitizeEmail(payload.email),
    subject: sanitizeText(payload.subject, 160),
    message: sanitizeMultilineText(payload.message, 5000),
  };
}

function sanitizeText(value, maxLength) {
  return escapeHtml(stripUnsafeCharacters(value).replace(/\s+/g, " ").trim()).slice(0, maxLength);
}

function sanitizeMultilineText(value, maxLength) {
  return escapeHtml(
    stripUnsafeCharacters(value)
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  ).slice(0, maxLength);
}

function sanitizeEmail(value) {
  return stripUnsafeCharacters(value).trim().toLowerCase().slice(0, 254);
}

function stripUnsafeCharacters(value) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isValidContactInput(input) {
  return (
    Boolean(input.name)
    && Boolean(input.email)
    && Boolean(input.subject)
    && Boolean(input.message)
    && isValidEmail(input.email)
  );
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.socket?.remoteAddress ?? "unknown";
}

function isRateLimited(clientIp) {
  const now = Date.now();

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.expiresAt <= now) {
      rateLimitStore.delete(key);
    }
  }

  const existingEntry = rateLimitStore.get(clientIp);

  if (!existingEntry || existingEntry.expiresAt <= now) {
    rateLimitStore.set(clientIp, {
      count: 1,
      expiresAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  if (existingEntry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  existingEntry.count += 1;
  rateLimitStore.set(clientIp, existingEntry);
  return false;
}

async function sendContactEmail(input) {
  const response = await fetch(MAIL_SERVICE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MAIL_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [MAIL_TO],
      subject: "New Contact Form Message",
      text: [
        "Name:",
        input.name,
        "",
        "Email:",
        input.email,
        "",
        "Subject:",
        input.subject,
        "",
        "Message:",
        input.message,
      ].join("\n"),
    }),
  });

  return response.ok;
}

const RATE_LIMIT_WINDOW_MS = Number(process.env.CONTACT_RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.CONTACT_RATE_LIMIT_MAX ?? 5);
const MAIL_SERVICE_URL = "https://api.resend.com/emails";
const MAIL_SERVICE_KEY = process.env.RESEND_API_KEY ?? process.env.CONTACT_EMAIL_API_KEY ?? "";
const MAIL_FROM = process.env.CONTACT_EMAIL_FROM ?? "";
const MAIL_TO = "support@signalforgeiq.com";

const rateLimitStore = new Map();

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  console.log("[contact] Request received", {
    method: req.method,
    url: req.url,
  });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  const clientIp = getClientIp(req);

  if (isRateLimited(clientIp)) {
    res.setHeader("Retry-After", String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
    console.warn("[contact] Rate limit exceeded", { clientIp });
    return res.status(429).json({
      success: false,
      error: "Too many requests",
    });
  }

  const mailConfigValidation = validateMailConfig();
  if (!mailConfigValidation.valid) {
    console.error("[contact] Email configuration invalid", mailConfigValidation);
    return res.status(500).json({
      success: false,
      error: "Contact service is temporarily unavailable",
    });
  }

  const payload = parseBody(req.body);

  if (!payload) {
    console.warn("[contact] Invalid JSON body");
    return res.status(400).json({
      success: false,
      error: "Invalid request body",
    });
  }

  const sanitizedInput = sanitizeContactInput(payload);

  if (sanitizedInput.company) {
    console.log("[contact] Honeypot field populated; accepting silently");
    return res.status(200).json({ success: true });
  }

  const inputValidation = validateContactInput(sanitizedInput);
  console.log("[contact] Validation result", inputValidation);

  if (!inputValidation.valid) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: inputValidation.errors,
    });
  }

  const emailSent = await sendSupportEmail(sanitizedInput);

  if (!emailSent.success) {
    return res.status(500).json({
      success: false,
      error: "Unable to deliver message",
    });
  }

  const autoReplySent = await sendAutoReplyEmail(sanitizedInput);

  if (!autoReplySent.success) {
    return res.status(500).json({
      success: false,
      error: "Unable to send confirmation email",
    });
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
    company: sanitizeText(payload.company, 120),
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

function validateContactInput(input) {
  const errors = [];

  if (!input.name) {
    errors.push("name is required");
  }

  if (!input.email) {
    errors.push("email is required");
  } else if (!isValidEmail(input.email)) {
    errors.push("email must be valid");
  }

  if (!input.subject) {
    errors.push("subject is required");
  }

  if (!input.message) {
    errors.push("message is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
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

async function sendSupportEmail(input) {
  return sendEmail({
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
    replyTo: input.email,
  });
}

async function sendAutoReplyEmail(input) {
  return sendEmail({
    to: [input.email],
    subject: "We received your message",
    text: [
      `Hi ${input.name},`,
      "",
      "Thanks for contacting SignalForge IQ.",
      "",
      "Our team has received your message and will get back to you shortly.",
      "",
      "- SignalForge Support",
    ].join("\n"),
  });
}

async function sendEmail({ to, subject, text, replyTo }) {
  const requestBody = {
    from: MAIL_FROM,
    to,
    subject,
    text,
    ...(replyTo ? { reply_to: replyTo } : {}),
  };

  console.log("[contact] Sending email via Resend", {
    to,
    subject,
    from: MAIL_FROM,
    hasReplyTo: Boolean(replyTo),
  });

  try {
    const response = await fetch(MAIL_SERVICE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MAIL_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const responseBody = await parseServiceResponse(response);

    if (!response.ok) {
      const errorDetails = {
        status: response.status,
        statusText: response.statusText,
        body: responseBody,
      };

      console.error("[contact] Resend send failed", errorDetails);

      if (looksLikeUnverifiedSender(responseBody)) {
        console.error(
          "[contact] Resend rejected the sender. Verify CONTACT_EMAIL_FROM in Resend and use a verified sending domain."
        );
      }

      return {
        success: false,
        error: errorDetails,
      };
    }

    console.log("[contact] Resend send succeeded", responseBody);

    return {
      success: true,
      data: responseBody,
    };
  } catch (error) {
    console.error("[contact] Resend request threw", serializeError(error));

    return {
      success: false,
      error: serializeError(error),
    };
  }
}

function validateMailConfig() {
  const issues = [];

  if (!MAIL_SERVICE_KEY) {
    issues.push("RESEND_API_KEY is missing");
  }

  if (!MAIL_FROM) {
    issues.push("CONTACT_EMAIL_FROM is missing");
  } else if (!isValidEmail(MAIL_FROM)) {
    issues.push("CONTACT_EMAIL_FROM must be a valid email address");
  }

  return {
    valid: issues.length === 0,
    issues,
    from: MAIL_FROM || null,
  };
}

async function parseServiceResponse(response) {
  const rawText = await response.text();

  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

function looksLikeUnverifiedSender(responseBody) {
  const text = typeof responseBody === "string"
    ? responseBody
    : JSON.stringify(responseBody ?? {});

  return /verify|verified|domain|sender/i.test(text);
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

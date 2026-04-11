import { enforceRateLimit, getRequestId, getRequestIp } from "../lib/securityRateLimit.js";

const RATE_LIMIT_WINDOW_MS = Number(process.env.CONTACT_RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.CONTACT_RATE_LIMIT_MAX ?? 5);
const MAIL_SERVICE_URL = "https://api.resend.com/emails";
const MAIL_SERVICE_KEY = process.env.RESEND_API_KEY ?? process.env.CONTACT_EMAIL_API_KEY ?? "";
const MAIL_FROM = process.env.CONTACT_EMAIL_FROM ?? "";
const MAIL_TO = "support@signalforgeiq.com";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const requestId = getRequestId(req);

  logInfo("request received", {
    requestId,
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

  const clientIp = getRequestIp(req);
  const rateLimit = await enforceRateLimit({
    route: "api/contact",
    identifier: clientIp,
    limit: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    logWarn("rate limit exceeded", {
      requestId,
      clientIp,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    return res.status(429).json({
      success: false,
      error: "Too many requests. Please wait and try again.",
    });
  }

  const mailConfigValidation = validateMailConfig();
  if (!mailConfigValidation.valid) {
    logError("email configuration invalid", {
      requestId,
      issueCount: mailConfigValidation.issueCount,
    });
    return res.status(500).json({
      success: false,
      error: "Contact service is temporarily unavailable",
    });
  }

  const payload = parseBody(req.body);

  if (!payload) {
    logWarn("invalid json body", { requestId });
    return res.status(400).json({
      success: false,
      error: "Invalid request body",
    });
  }

  const sanitizedInput = sanitizeContactInput(payload);

  if (sanitizedInput.company) {
    logInfo("honeypot field populated", { requestId });
    return res.status(200).json({ success: true });
  }

  const inputValidation = validateContactInput(sanitizedInput);

  if (!inputValidation.valid) {
    logWarn("validation failed", {
      requestId,
      errorCount: inputValidation.errors.length,
    });
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: inputValidation.errors,
    });
  }

  const emailSent = await sendSupportEmail(sanitizedInput, requestId);

  if (!emailSent.success) {
    return res.status(500).json({
      success: false,
      error: "Unable to deliver message",
    });
  }

  const autoReplySent = await sendAutoReplyEmail(sanitizedInput, requestId);

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

async function sendSupportEmail(input, requestId) {
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
    requestId,
  });
}

async function sendAutoReplyEmail(input, requestId) {
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
    requestId,
  });
}

async function sendEmail({ to, subject, text, replyTo, requestId }) {
  const requestBody = {
    from: MAIL_FROM,
    to,
    subject,
    text,
    ...(replyTo ? { reply_to: replyTo } : {}),
  };

  logInfo("sending email via provider", {
    requestId,
    recipientCount: to.length,
    subject,
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
      logError("email provider request failed", {
        requestId,
        status: response.status,
        statusText: response.statusText,
        unverifiedSenderLikely: looksLikeUnverifiedSender(responseBody),
      });

      return {
        success: false,
        error: {
          status: response.status,
          statusText: response.statusText,
        },
      };
    }

    logInfo("email provider request succeeded", {
      requestId,
      status: response.status,
    });

    return {
      success: true,
      data: responseBody ? { ok: true } : null,
    };
  } catch (error) {
    logError("email provider request threw", {
      requestId,
      error: serializeError(error),
    });

    return {
      success: false,
      error: serializeError(error),
    };
  }
}

function validateMailConfig() {
  const issues = [];

  if (!MAIL_SERVICE_KEY) {
    issues.push("missing-mail-service-key");
  }

  if (!MAIL_FROM) {
    issues.push("missing-mail-from");
  } else if (!isValidEmail(MAIL_FROM)) {
    issues.push("invalid-mail-from");
  }

  return {
    valid: issues.length === 0,
    issueCount: issues.length,
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
    };
  }

  return {
    message: String(error),
  };
}

function logInfo(message, metadata) {
  console.log("[contact]", message, metadata);
}

function logWarn(message, metadata) {
  console.warn("[contact]", message, metadata);
}

function logError(message, metadata) {
  console.error("[contact]", message, metadata);
}

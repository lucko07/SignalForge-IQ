type TermsSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

const termsSections: TermsSection[] = [
  {
    title: "Overview",
    paragraphs: [
      "These Terms of Service govern your access to and use of SignalForge IQ, including its public pages, free account features, paid memberships, trading signal content, educational materials, account tools, and related support services.",
      "By using SignalForge IQ, you agree to these Terms. If you do not agree, do not use the platform.",
    ],
  },
  {
    title: "Eligibility And Accounts",
    paragraphs: [
      "You are responsible for providing accurate registration information, maintaining the security of your account credentials, and restricting access to your account.",
      "You are responsible for activity that occurs under your account unless you notify us promptly of unauthorized access.",
    ],
    bullets: [
      "You must be legally able to enter into a binding agreement.",
      "You may not create an account using false, misleading, or unauthorized information.",
      "You may not share access in a way that bypasses your selected plan or intended account use.",
    ],
  },
  {
    title: "Membership Plans And Billing",
    paragraphs: [
      "SignalForge IQ may offer free access as well as paid memberships, including Pro and Elite. Paid memberships provide additional access to subscriber-only content and features.",
      "Paid plans renew automatically unless canceled before the next billing date. Pricing, renewal timing, and available plan features may be updated from time to time.",
    ],
    bullets: [
      "Pro is intended to include protected dashboard access, live signals, closed trade history, and performance tracking.",
      "Elite is intended to include everything in Pro plus higher-tier premium access and future expanded member benefits.",
      "If payment cannot be completed or maintained, paid access may be limited, suspended, or downgraded.",
    ],
  },
  {
    title: "Cancellations And Refunds",
    paragraphs: [
      "You may cancel a paid membership through your account billing tools or by contacting support, subject to any billing-cycle timing shown at the time of cancellation.",
      "Unless otherwise required by law or expressly stated in writing, fees are non-refundable once billed for an active subscription period.",
    ],
  },
  {
    title: "Acceptable Use",
    paragraphs: [
      "You may use SignalForge IQ only for lawful purposes and in a manner consistent with these Terms.",
    ],
    bullets: [
      "Do not attempt to interfere with platform security, availability, or account access controls.",
      "Do not scrape, copy, republish, or resell platform content without written permission.",
      "Do not use the service to infringe the rights of others or to distribute harmful, unlawful, or abusive material.",
      "Do not attempt to reverse engineer, bypass, or misuse paid-access restrictions.",
    ],
  },
  {
    title: "Signals, Education, And No Guaranteed Results",
    paragraphs: [
      "SignalForge IQ provides trading signals, market insights, and educational content for informational purposes only. The platform is not a broker, investment adviser, fiduciary, or custodian.",
      "Nothing on SignalForge IQ should be treated as personalized investment, legal, tax, or financial advice. You remain solely responsible for your own trading, investment, and risk decisions.",
      "Market conditions vary, opportunities change, and outcomes are uncertain. Signal frequency, timing, and performance are not guaranteed.",
    ],
  },
  {
    title: "Intellectual Property",
    paragraphs: [
      "SignalForge IQ and its content, including text, branding, layouts, graphics, educational materials, and signal presentation formats, are owned by or licensed to SignalForge IQ and are protected by applicable intellectual property laws.",
      "Except for limited personal use consistent with your plan, you may not reproduce, distribute, modify, publicly display, or create derivative works from platform content without prior written permission.",
    ],
  },
  {
    title: "Service Availability",
    paragraphs: [
      "We may update, suspend, restrict, or discontinue any portion of the platform at any time, including features, plan access, content categories, or account tools.",
      "We do not guarantee uninterrupted availability, error-free operation, or continuous access to every feature at all times.",
    ],
  },
  {
    title: "Disclaimers",
    paragraphs: [
      "SignalForge IQ is provided on an \"as is\" and \"as available\" basis to the fullest extent permitted by law. We disclaim warranties of any kind, whether express or implied, including implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement.",
    ],
  },
  {
    title: "Limitation Of Liability",
    paragraphs: [
      "To the fullest extent permitted by law, SignalForge IQ and its owners, operators, affiliates, employees, and contractors will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, revenues, data, business, opportunities, or trading losses arising from or related to your use of the platform.",
      "If liability cannot be excluded, the maximum liability of SignalForge IQ for claims arising out of or related to the platform will be limited to the amount you paid to SignalForge IQ for the service during the 12 months before the event giving rise to the claim.",
    ],
  },
  {
    title: "Termination",
    paragraphs: [
      "We may suspend or terminate access to SignalForge IQ if we reasonably believe you violated these Terms, created risk for the platform or other users, or used the service unlawfully or abusively.",
      "Sections that by their nature should survive termination will continue to apply after access ends.",
    ],
  },
  {
    title: "Changes To These Terms",
    paragraphs: [
      "We may revise these Terms from time to time. Updated Terms become effective when posted on this page unless a later date is stated.",
    ],
  },
  {
    title: "Contact Information",
    paragraphs: [
      "Questions about these Terms may be sent to support@signalforgeiq.com.",
      "Business name for final review: [Insert Legal Business Name]",
      "Business mailing address for final review: [Insert Mailing Address]",
    ],
  },
];

function TermsPage() {
  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <p style={eyebrowStyle}>Legal</p>
        <h1 style={heroTitleStyle}>Terms of Service</h1>
        <p style={heroDescriptionStyle}>
          These Terms explain the rules for using SignalForge IQ, including account access,
          paid memberships, content use, and important legal limitations.
        </p>
        <p style={heroMetaStyle}>Last updated: March 21, 2026</p>
      </div>

      <div style={sectionListStyle}>
        {termsSections.map((section) => (
          <article key={section.title} style={sectionCardStyle}>
            <h2 style={sectionTitleStyle}>{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} style={bodyStyle}>
                {paragraph}
              </p>
            ))}
            {section.bullets ? (
              <ul style={listStyle}>
                {section.bullets.map((bullet) => (
                  <li key={bullet} style={listItemStyle}>
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

const pageStyle = {
  display: "grid",
  gap: "1.5rem",
  padding: "2rem 0",
};

const heroStyle = {
  display: "grid",
  gap: "0.85rem",
  padding: "2rem",
  borderRadius: "24px",
  border: "1px solid #d0d5dd",
  background:
    "linear-gradient(135deg, rgba(16,24,40,1) 0%, rgba(29,41,57,1) 58%, rgba(71,84,103,1) 100%)",
  color: "#ffffff",
};

const eyebrowStyle = {
  margin: 0,
  color: "#d0d5dd",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  fontSize: "0.82rem",
};

const heroTitleStyle = {
  margin: 0,
  fontSize: "2.6rem",
  lineHeight: 1.05,
};

const heroDescriptionStyle = {
  margin: 0,
  maxWidth: "760px",
  color: "#eaecf0",
  lineHeight: 1.7,
};

const heroMetaStyle = {
  margin: 0,
  color: "#d0d5dd",
  fontSize: "0.95rem",
  fontWeight: 600,
};

const sectionListStyle = {
  display: "grid",
  gap: "1rem",
};

const sectionCardStyle = {
  display: "grid",
  gap: "0.85rem",
  padding: "1.5rem",
  borderRadius: "20px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
};

const sectionTitleStyle = {
  margin: 0,
  color: "#101828",
  fontSize: "1.35rem",
};

const bodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.75,
};

const listStyle = {
  margin: 0,
  paddingLeft: "1.2rem",
  color: "#475467",
  display: "grid",
  gap: "0.5rem",
};

const listItemStyle = {
  lineHeight: 1.7,
};

export default TermsPage;

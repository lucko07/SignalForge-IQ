type PrivacySection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

const privacySections: PrivacySection[] = [
  {
    title: "Overview",
    paragraphs: [
      "This Privacy Policy explains how SignalForge IQ collects, uses, stores, and protects information when you visit the website, create an account, contact support, or use free or paid membership features.",
      "By using SignalForge IQ, you acknowledge the practices described in this Privacy Policy.",
    ],
  },
  {
    title: "Information We Collect",
    paragraphs: [
      "We may collect information you provide directly, information generated through your use of the platform, and limited technical data needed to operate and protect the service.",
    ],
    bullets: [
      "Account information such as name, email address, login details, and account status",
      "Membership and billing-related information such as plan level, subscription status, and transaction records",
      "Contact form submissions and support messages, including the details you choose to provide",
      "Usage information such as page visits, device or browser details, and interactions with platform features",
      "Cookies and similar technologies that help support login sessions, site performance, and measurement tools if used",
    ],
  },
  {
    title: "How We Use Information",
    bullets: [
      "To create and maintain accounts",
      "To provide access to free and paid features",
      "To process subscriptions, renewals, cancellations, and billing support",
      "To respond to support requests and contact form submissions",
      "To improve the platform, understand usage trends, and protect service security",
      "To comply with legal obligations and enforce our Terms",
    ],
  },
  {
    title: "Account And Payment Information",
    paragraphs: [
      "Account details are used to manage access, authenticate users, and maintain membership status.",
      "Payment details are handled through our payment processing and billing tools. SignalForge IQ may receive limited billing-related information such as subscription status, transaction references, and customer support details, but does not need to display full payment card information within the platform.",
    ],
  },
  {
    title: "Contact Form And Support Communications",
    paragraphs: [
      "If you contact SignalForge IQ through the website, email, or support channels, we may collect your name, email address, subject line, and the contents of your message.",
      "We use this information to respond to inquiries, provide support, review service-related issues, and maintain support records as reasonably necessary.",
    ],
  },
  {
    title: "Cookies And Analytics",
    paragraphs: [
      "SignalForge IQ may use cookies or similar technologies to keep you signed in, maintain site functionality, remember preferences, and understand general website usage.",
      "If analytics tools are used, they are intended to help us measure site traffic, improve performance, and understand how visitors engage with the platform.",
    ],
  },
  {
    title: "How We Share Information",
    paragraphs: [
      "We do not sell personal information. We may share information with service providers and professional advisers who help operate the platform, process billing, support communications, host infrastructure, maintain security, or meet legal obligations.",
      "We may also disclose information when reasonably necessary to comply with law, enforce our rights, protect users, or address fraud, abuse, or security issues.",
    ],
  },
  {
    title: "Data Retention",
    paragraphs: [
      "We retain information for as long as reasonably necessary to operate the platform, maintain records, fulfill subscriptions, respond to support requests, resolve disputes, enforce agreements, and meet legal or compliance obligations.",
    ],
  },
  {
    title: "Security",
    paragraphs: [
      "SignalForge IQ uses reasonable administrative, technical, and organizational measures to protect information. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.",
    ],
  },
  {
    title: "Your Choices",
    bullets: [
      "You may review or update account information through your account settings where available.",
      "You may cancel paid memberships through your billing tools, subject to billing-cycle timing.",
      "You may contact us to request account assistance or ask privacy-related questions.",
      "You may adjust browser settings to limit cookies, though some site features may not work properly as a result.",
    ],
  },
  {
    title: "Children's Privacy",
    paragraphs: [
      "SignalForge IQ is not intended for children under 13, and we do not knowingly collect personal information from children under 13.",
    ],
  },
  {
    title: "Changes To This Policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. Updates become effective when posted on this page unless a later date is stated.",
    ],
  },
  {
    title: "Contact Information",
    paragraphs: [
      "Privacy questions may be sent to support@signalforgeiq.com.",
      "Business name for final review: [Insert Legal Business Name]",
      "Business mailing address for final review: [Insert Mailing Address]",
    ],
  },
];

function PrivacyPolicyPage() {
  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <p style={eyebrowStyle}>Legal</p>
        <h1 style={heroTitleStyle}>Privacy Policy</h1>
        <p style={heroDescriptionStyle}>
          This Policy explains what information SignalForge IQ collects, how it is used,
          and how account, billing, and support-related data are handled.
        </p>
        <p style={heroMetaStyle}>Last updated: March 21, 2026</p>
      </div>

      <div style={sectionListStyle}>
        {privacySections.map((section) => (
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

export default PrivacyPolicyPage;

import { Link } from "react-router-dom";

type FaqItem = {
  question: string;
  answer: string;
};

type FaqCategory = {
  title: string;
  description: string;
  items: FaqItem[];
};

const faqCategories: FaqCategory[] = [
  {
    title: "Signals",
    description: "Core questions about what signals are, how they are presented, and how to interpret them.",
    items: [
      {
        question: "What is a trading signal?",
        answer:
          "A trading signal is a structured trade idea that outlines a market, direction, entry area, risk level, and target so traders can review a setup in a clear format.",
      },
      {
        question: "What information does a SignalForge IQ signal include?",
        answer:
          "SignalForge IQ signals typically include the symbol, asset type, direction, entry, stop loss, target, thesis, and current status so the setup is easy to understand at a glance.",
      },
      {
        question: "Are signals posted instantly?",
        answer:
          "Signals may be checked before appearing live. That helps keep the feed organized and makes it easier to distinguish what is still pending from what is already active.",
      },
      {
        question: "What do statuses like pending, active, and closed mean?",
        answer:
          "Pending means a signal is still under review, active means the idea is live, and closed means the trade has finished. Closed trades may later be categorized as a win, loss, or breakeven.",
      },
      {
        question: "Are signals financial advice?",
        answer:
          "No. SignalForge IQ provides structured trade ideas and educational information only. Users remain responsible for their own analysis, execution, and risk management decisions.",
      },
    ],
  },
  {
    title: "Memberships",
    description: "A quick overview of how Free, Pro, and Elite access are separated on the platform.",
    items: [
      {
        question: "What is included in the Free plan?",
        answer:
          "Free users stay on public pages and can preview public-facing content. The Free plan does not include access to the protected member dashboard.",
      },
      {
        question: "What is included in the Pro plan?",
        answer:
          "Pro unlocks the protected dashboard, member signal access, billing visibility, and the main subscription-managed account experience.",
      },
      {
        question: "What is included in the Elite plan?",
        answer:
          "Elite includes the protected dashboard and premium membership tier access, with room for future advanced member features as the platform expands.",
      },
      {
        question: "Can I upgrade later?",
        answer:
          "Yes. Free users can upgrade later, and Pro members can move to Elite when that higher tier fits their needs.",
      },
    ],
  },
  {
    title: "Billing",
    description: "Answers about subscriptions, cancellations, billing access, and payment management.",
    items: [
      {
        question: "How does billing work?",
        answer:
          "Paid memberships are managed through secure recurring billing. When a subscription is active, your account reflects the correct plan and billing status automatically.",
      },
      {
        question: "Can I cancel my subscription anytime?",
        answer:
          "Yes. Subscriptions can be canceled from your account billing page. In most cases, cancellation is scheduled for the end of the current billing period.",
      },
      {
        question: "What happens after I cancel?",
        answer:
          "Your subscription remains scheduled to end at the end of the current billing period. After that point, the account returns to the Free plan unless another paid subscription becomes active.",
      },
      {
        question: "Will I keep access until the billing period ends?",
        answer:
          "Yes. If your cancellation is scheduled for period end, paid access remains active until the stored subscription end date is reached.",
      },
      {
        question: "Can I manage my payment method?",
        answer:
          "Yes. Paid members can use the account billing page to review billing details, manage payment methods, and handle subscription changes.",
      },
    ],
  },
  {
    title: "Access & Accounts",
    description: "Common questions about protected pages, upgrades, payment issues, and account continuity.",
    items: [
      {
        question: "Why can't Free users access the protected dashboard?",
        answer:
          "The protected dashboard is reserved for paid member access. Free users stay on public pages, while Pro and Elite unlock the member dashboard.",
      },
      {
        question: "What happens when I upgrade to Pro or Elite?",
        answer:
          "After payment is completed and your membership is confirmed, your account plan updates and access expands to the protected dashboard.",
      },
      {
        question: "What happens if my payment fails?",
        answer:
          "Your billing status may move into a payment-trouble state such as past due. You should update your payment method promptly to avoid interruption to paid access.",
      },
      {
        question: "Can I reset my password?",
        answer:
          "Yes. The login flow supports password reset so you can regain access to the same account without creating a new one.",
      },
      {
        question: "Can I use the same account when upgrading?",
        answer:
          "Yes. Upgrades are meant to happen on your existing account so your membership state and dashboard access stay attached to one login.",
      },
    ],
  },
];

function FaqPage() {
  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <p style={eyebrowStyle}>Support Center</p>
        <h1 style={heroTitleStyle}>Frequently Asked Questions</h1>
        <p style={heroDescriptionStyle}>
          Answers about signals, memberships, billing, and platform access.
        </p>
      </div>

      <div style={categoryGridStyle}>
        {faqCategories.map((category) => (
          <article key={category.title} style={categoryCardStyle}>
            <div style={categoryHeaderStyle}>
              <p style={categoryEyebrowStyle}>Category</p>
              <h2 style={categoryTitleStyle}>{category.title}</h2>
              <p style={categoryDescriptionStyle}>{category.description}</p>
            </div>

            <div style={accordionStackStyle}>
              {category.items.map((item) => (
                <details key={item.question} style={accordionItemStyle}>
                  <summary style={accordionSummaryStyle}>
                    <span>{item.question}</span>
                    <span style={accordionIconStyle}>+</span>
                  </summary>
                  <p style={accordionAnswerStyle}>{item.answer}</p>
                </details>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div style={supportCardStyle}>
        <div style={supportTextStyle}>
          <p style={categoryEyebrowStyle}>Need More Help?</p>
          <h2 style={categoryTitleStyle}>Still have questions?</h2>
          <p style={categoryDescriptionStyle}>
            Visit the Contact page if you need more help with memberships, billing, or getting started with SignalForge IQ.
          </p>
        </div>
        <Link to="/contact" style={supportLinkStyle}>
          Contact support
        </Link>
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
  color: "#eaecf0",
  maxWidth: "720px",
  fontSize: "1.05rem",
  lineHeight: 1.7,
};

const categoryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1rem",
};

const categoryCardStyle = {
  display: "grid",
  gap: "1.2rem",
  padding: "1.5rem",
  borderRadius: "22px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  boxShadow: "0 10px 30px rgba(16, 24, 40, 0.05)",
};

const categoryHeaderStyle = {
  display: "grid",
  gap: "0.45rem",
};

const categoryEyebrowStyle = {
  margin: 0,
  color: "#475467",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  fontSize: "0.78rem",
};

const categoryTitleStyle = {
  margin: 0,
  color: "#101828",
  fontSize: "1.45rem",
};

const categoryDescriptionStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.65,
};

const accordionStackStyle = {
  display: "grid",
  gap: "0.75rem",
};

const accordionItemStyle = {
  border: "1px solid #eaecf0",
  borderRadius: "16px",
  backgroundColor: "#f8fafc",
  padding: "0.95rem 1rem",
};

const accordionSummaryStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
  cursor: "pointer",
  listStyle: "none",
  color: "#101828",
  fontWeight: 700,
};

const accordionIconStyle = {
  flexShrink: 0,
  color: "#475467",
  fontSize: "1.1rem",
  lineHeight: 1,
};

const accordionAnswerStyle = {
  margin: "0.9rem 0 0",
  color: "#475467",
  lineHeight: 1.7,
};

const supportCardStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "1rem",
  alignItems: "center",
  padding: "1.5rem",
  borderRadius: "22px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#f8fafc",
};

const supportTextStyle = {
  display: "grid",
  gap: "0.45rem",
};

const supportLinkStyle = {
  justifySelf: "start" as const,
  display: "inline-flex",
  textDecoration: "none",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.9rem 1.1rem",
  borderRadius: "12px",
  backgroundColor: "#101828",
  color: "#ffffff",
  fontWeight: 700,
};

export default FaqPage;

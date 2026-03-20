function ContactPage() {
  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <p style={eyebrowStyle}>Support</p>
        <h1 style={heroTitleStyle}>Contact SignalForge IQ</h1>
        <p style={heroDescriptionStyle}>
          Reach out for account help, billing questions, or general support. We keep communication clear,
          professional, and focused on getting you the right answer quickly.
        </p>
      </div>

      <div style={contentGridStyle}>
        <div style={infoColumnStyle}>
          <div style={cardStackStyle}>
            <article style={infoCardStyle}>
              <p style={sectionLabelStyle}>Support Contact</p>
              <h2 style={cardTitleStyle}>General Support</h2>
              <p style={cardDescriptionStyle}>
                For account questions, platform guidance, or help getting started, contact our support team.
              </p>
              <a href="mailto:support@signalforgeiq.com" style={emailLinkStyle}>
                support@signalforgeiq.com
              </a>
            </article>

            <article style={infoCardStyle}>
              <p style={sectionLabelStyle}>Billing Contact</p>
              <h2 style={cardTitleStyle}>Billing Help</h2>
              <p style={cardDescriptionStyle}>
                For plan changes, payment questions, or subscription-related support, contact billing directly.
              </p>
              <a href="mailto:billing@signalforgeiq.com" style={emailLinkStyle}>
                billing@signalforgeiq.com
              </a>
            </article>
          </div>

          <article style={detailCardStyle}>
            <h2 style={detailTitleStyle}>Response Time</h2>
            <p style={detailBodyStyle}>
              Most messages receive a response within 1 business day. More detailed account or billing requests may
              take slightly longer when additional review is needed.
            </p>
          </article>

          <article style={detailCardStyle}>
            <h2 style={detailTitleStyle}>Business Hours</h2>
            <p style={detailBodyStyle}>Monday to Friday, 9:00 AM to 5:00 PM Eastern Time.</p>
            <p style={detailMutedStyle}>Messages sent outside business hours are reviewed on the next business day.</p>
          </article>
        </div>

        <article style={formCardStyle}>
          <div style={formHeaderStyle}>
            <p style={sectionLabelStyle}>Send a Message</p>
            <h2 style={formTitleStyle}>Contact Form</h2>
            <p style={cardDescriptionStyle}>
              Share a few details below and use the contact email that best fits your request.
            </p>
          </div>

          <form style={formStyle}>
            <div style={formGridStyle}>
              <label style={fieldStyle}>
                <span style={fieldLabelStyle}>Name</span>
                <input type="text" name="name" placeholder="Your name" style={inputStyle} />
              </label>

              <label style={fieldStyle}>
                <span style={fieldLabelStyle}>Email</span>
                <input type="email" name="email" placeholder="you@example.com" style={inputStyle} />
              </label>
            </div>

            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Subject</span>
              <input type="text" name="subject" placeholder="How can we help?" style={inputStyle} />
            </label>

            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Message</span>
              <textarea
                name="message"
                rows={7}
                placeholder="Tell us a little about your question or request."
                style={textareaStyle}
              />
            </label>

            <div style={formFooterStyle}>
              <p style={formNoteStyle}>
                This form is currently for layout and message drafting only. Please email the appropriate team above
                for a direct response.
              </p>
              <button type="button" style={buttonStyle}>
                Send Message
              </button>
            </div>
          </form>
        </article>
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

const contentGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "1rem",
  alignItems: "start",
};

const infoColumnStyle = {
  display: "grid",
  gap: "1rem",
};

const cardStackStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};

const infoCardStyle = {
  display: "grid",
  gap: "0.75rem",
  padding: "1.5rem",
  borderRadius: "20px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
};

const detailCardStyle = {
  display: "grid",
  gap: "0.5rem",
  padding: "1.5rem",
  borderRadius: "20px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#f8fafc",
};

const formCardStyle = {
  display: "grid",
  gap: "1.25rem",
  padding: "1.5rem",
  borderRadius: "24px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  boxShadow: "0 8px 24px rgba(16, 24, 40, 0.06)",
};

const formHeaderStyle = {
  display: "grid",
  gap: "0.5rem",
};

const sectionLabelStyle = {
  margin: 0,
  color: "#667085",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  fontSize: "0.78rem",
};

const cardTitleStyle = {
  margin: 0,
  color: "#101828",
  fontSize: "1.35rem",
};

const formTitleStyle = {
  margin: 0,
  color: "#101828",
  fontSize: "1.75rem",
};

const cardDescriptionStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.7,
};

const emailLinkStyle = {
  color: "#101828",
  fontWeight: 700,
  textDecoration: "none",
  fontSize: "1rem",
};

const detailTitleStyle = {
  margin: 0,
  color: "#101828",
  fontSize: "1.15rem",
};

const detailBodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.7,
};

const detailMutedStyle = {
  margin: 0,
  color: "#667085",
  lineHeight: 1.6,
  fontSize: "0.95rem",
};

const formStyle = {
  display: "grid",
  gap: "1rem",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "1rem",
};

const fieldStyle = {
  display: "grid",
  gap: "0.45rem",
};

const fieldLabelStyle = {
  color: "#344054",
  fontWeight: 700,
  fontSize: "0.92rem",
};

const inputStyle = {
  width: "100%",
  padding: "0.95rem 1rem",
  borderRadius: "14px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  color: "#101828",
  fontSize: "0.98rem",
  outline: "none",
  boxSizing: "border-box" as const,
};

const textareaStyle = {
  ...inputStyle,
  resize: "vertical" as const,
  minHeight: "160px",
  fontFamily: "inherit",
};

const formFooterStyle = {
  display: "grid",
  gap: "0.9rem",
};

const formNoteStyle = {
  margin: 0,
  color: "#667085",
  lineHeight: 1.6,
  fontSize: "0.95rem",
};

const buttonStyle = {
  justifySelf: "start",
  padding: "0.95rem 1.35rem",
  borderRadius: "999px",
  border: "1px solid #101828",
  backgroundColor: "#101828",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};

export default ContactPage;

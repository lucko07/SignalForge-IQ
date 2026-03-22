function MaintenancePage() {
  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <p style={eyebrowStyle}>Temporary Maintenance</p>
        <h1 style={titleStyle}>SignalForge IQ is temporarily offline for updates.</h1>
        <p style={bodyStyle}>
          We are performing maintenance to keep the platform stable, secure, and ready for the next session.
        </p>
        <p style={reassuranceStyle}>
          Your account and membership details remain intact. Please check back shortly.
        </p>
        <p style={supportStyle}>
          If you need assistance, please contact SignalForge IQ support after service returns or through your normal
          support channel.
        </p>
      </section>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "2rem",
  background:
    "radial-gradient(circle at top, rgba(29,41,57,0.18), transparent 34%), linear-gradient(180deg, #f8fafc 0%, #eef2f6 100%)",
};

const panelStyle = {
  width: "100%",
  maxWidth: "760px",
  display: "grid",
  gap: "0.9rem",
  padding: "2rem",
  borderRadius: "24px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  boxShadow: "0 20px 60px rgba(16, 24, 40, 0.08)",
};

const eyebrowStyle = {
  margin: 0,
  color: "#475467",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  fontSize: "0.82rem",
};

const titleStyle = {
  margin: 0,
  color: "#101828",
  fontSize: "clamp(2rem, 5vw, 3.25rem)",
  lineHeight: 1.05,
};

const bodyStyle = {
  margin: 0,
  color: "#344054",
  lineHeight: 1.75,
  fontSize: "1.05rem",
};

const reassuranceStyle = {
  margin: 0,
  padding: "1rem 1.1rem",
  borderRadius: "16px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#f8fafc",
  color: "#475467",
  lineHeight: 1.7,
};

const supportStyle = {
  margin: 0,
  color: "#667085",
  lineHeight: 1.7,
};

export default MaintenancePage;

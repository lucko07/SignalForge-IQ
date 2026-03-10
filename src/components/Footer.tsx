function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid #d6d9e0",
        marginTop: "2rem",
        backgroundColor: "#f8fafc",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "1.25rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          color: "#475467",
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>SignalForge IQ</p>
        <p style={{ margin: 0 }}>Market education, signals, and account access.</p>
      </div>
    </footer>
  );
}

export default Footer;

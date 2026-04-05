import { Link } from "react-router-dom";
import DataMaintenancePanel from "../../components/admin/DataMaintenancePanel";

function AdminDataPage() {
  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <div>
          <p style={eyebrowStyle}>Administration</p>
          <h1 style={titleStyle}>Data Maintenance</h1>
          <p style={bodyStyle}>
            Archive and classify records safely, and rebuild performance summaries without bulk deleting live data.
          </p>
        </div>
        <Link to="/admin/signals" style={linkStyle}>
          Back to signal review
        </Link>
      </div>

      <DataMaintenancePanel />
    </section>
  );
}

const pageStyle = {
  display: "grid",
  gap: "1rem",
};

const heroStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.5rem",
  borderRadius: "24px",
  border: "1px solid #1f2937",
  background: "linear-gradient(135deg, #020617 0%, #111827 55%, #0f172a 100%)",
};

const eyebrowStyle = {
  margin: 0,
  color: "#38bdf8",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  fontSize: "0.8rem",
};

const titleStyle = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "2.3rem",
};

const bodyStyle = {
  margin: 0,
  color: "#94a3b8",
  lineHeight: 1.7,
};

const linkStyle = {
  width: "fit-content",
  textDecoration: "none",
  padding: "0.85rem 1rem",
  borderRadius: "12px",
  border: "1px solid #334155",
  backgroundColor: "#111827",
  color: "#f8fafc",
  fontWeight: 700,
};

export default AdminDataPage;

import { Link } from "react-router-dom";

type EducationVideoSectionProps = {
  title?: string;
  eyebrow?: string;
  videoUrl?: string;
  ctaTo?: string;
  ctaLabel?: string;
};

const phasedHighlights = [
  {
    title: "Phase 1",
    description: "Start with manual signals, analytics, and performance tracking while learning the system.",
  },
  {
    title: "Phase 2",
    description: "Elite introduces execution-ready automation with controlled delivery and supported integrations.",
  },
  {
    title: "Phase 3",
    description: "The first execution path begins with Alpaca paper trading so users can test safely before going live.",
  },
  {
    title: "Phase 4",
    description: "Live execution and advanced routing are added only for users who are ready for that stage.",
  },
] as const;

function EducationVideoSection({
  title = "How SignalForge IQ Works",
  eyebrow = "Product Walkthrough",
  videoUrl,
  ctaTo = "/pricing",
  ctaLabel = "Explore Plans",
}: EducationVideoSectionProps) {
  const hasVideo = typeof videoUrl === "string" && videoUrl.trim().length > 0;

  return (
    <article style={sectionShellStyle}>
      <div style={headerGridStyle}>
        <div style={copyColumnStyle}>
          <p style={eyebrowStyle}>{eyebrow}</p>
          <h2 style={titleStyle}>{title}</h2>
          <p style={leadStyle}>
            SignalForge IQ is built to help users move from signals to structured automation in
            a controlled, phased way.
          </p>
          <p style={supportStyle}>
            Start with signals. Learn the system. Upgrade when ready. Automate with control. The
            progression is designed to stay selective, transparent, and realistic at each stage.
          </p>
        </div>

        <div style={ctaColumnStyle}>
          <div style={statusCardStyle}>
            <span style={statusPillStyle}>48-second explainer</span>
            <p style={statusBodyStyle}>
              A short product walkthrough that explains how members progress from manual review
              into execution-ready workflows without skipping the learning stage.
            </p>
            <Link to={ctaTo} style={primaryLinkStyle}>
              {ctaLabel}
            </Link>
          </div>
        </div>
      </div>

      <div style={mediaGridStyle}>
        <div style={videoShellStyle}>
          {hasVideo ? (
            <video controls preload="metadata" playsInline style={videoPlayerStyle}>
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : (
            <div style={placeholderStyle}>
              <div style={placeholderCenterStyle}>
                <span style={placeholderBadgeStyle}>Video Placeholder</span>
                <h3 style={placeholderTitleStyle}>Ready for the hosted explainer</h3>
                <p style={placeholderBodyStyle}>
                  Swap in the final 48-second product video here once it is exported and hosted.
                </p>
              </div>
            </div>
          )}
        </div>

        <div style={highlightsCardStyle}>
          <p style={highlightsEyebrowStyle}>Product rollout</p>
          <div style={phaseGridStyle}>
            {phasedHighlights.map((phase) => (
              <div key={phase.title} style={phaseCardStyle}>
                <strong style={phaseTitleStyle}>{phase.title}</strong>
                <p style={phaseBodyStyle}>{phase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={footerNoteStyle}>
        BTC Precision Engine is live today. Momentum remains in development, while Elite is
        positioned as the execution-ready layer with supported integrations and a paper-first path.
      </div>
    </article>
  );
}

const sectionShellStyle = {
  display: "grid",
  gap: "1.25rem",
  padding: "1.5rem",
  borderRadius: "24px",
  border: "1px solid #d0d5dd",
  background:
    "radial-gradient(circle at top left, rgba(200, 215, 232, 0.24), transparent 28%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  boxShadow: "0 12px 32px rgba(16, 24, 40, 0.06)",
};

const headerGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1rem",
  alignItems: "start",
};

const copyColumnStyle = {
  display: "grid",
  gap: "0.7rem",
};

const ctaColumnStyle = {
  display: "grid",
  alignContent: "start",
};

const eyebrowStyle = {
  margin: 0,
  color: "#475467",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  fontSize: "0.78rem",
};

const titleStyle = {
  margin: 0,
  color: "#101828",
  fontSize: "1.95rem",
};

const leadStyle = {
  margin: 0,
  color: "#101828",
  lineHeight: 1.7,
  fontSize: "1.04rem",
  maxWidth: "62ch",
};

const supportStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.7,
  maxWidth: "64ch",
};

const statusCardStyle = {
  display: "grid",
  gap: "0.8rem",
  padding: "1rem",
  borderRadius: "18px",
  border: "1px solid #d7dde7",
  backgroundColor: "#ffffff",
};

const statusPillStyle = {
  justifySelf: "start",
  padding: "0.35rem 0.65rem",
  borderRadius: "999px",
  backgroundColor: "#eef4ff",
  color: "#1d4ed8",
  fontWeight: 700,
  fontSize: "0.78rem",
  letterSpacing: "0.03em",
  textTransform: "uppercase" as const,
};

const statusBodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.65,
};

const primaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  padding: "0.9rem 1.15rem",
  borderRadius: "12px",
  backgroundColor: "#101828",
  color: "#ffffff",
  fontWeight: 700,
};

const mediaGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 0.9fr)",
  gap: "1rem",
};

const videoShellStyle = {
  borderRadius: "22px",
  overflow: "hidden",
  border: "1px solid #d7dde7",
  backgroundColor: "#101828",
  minHeight: "100%",
};

const videoPlayerStyle = {
  display: "block",
  width: "100%",
  height: "100%",
  minHeight: "320px",
  aspectRatio: "16 / 9",
};

const placeholderStyle = {
  display: "grid",
  placeItems: "center",
  minHeight: "320px",
  padding: "2rem",
  background:
    "linear-gradient(135deg, rgba(16,24,40,1) 0%, rgba(23,32,51,1) 55%, rgba(33,55,83,1) 100%)",
};

const placeholderCenterStyle = {
  display: "grid",
  gap: "0.7rem",
  maxWidth: "420px",
  textAlign: "center" as const,
};

const placeholderBadgeStyle = {
  justifySelf: "center",
  padding: "0.35rem 0.7rem",
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.16)",
  backgroundColor: "rgba(255,255,255,0.08)",
  color: "#d0d5dd",
  fontWeight: 700,
  fontSize: "0.78rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
};

const placeholderTitleStyle = {
  margin: 0,
  color: "#ffffff",
  fontSize: "1.4rem",
};

const placeholderBodyStyle = {
  margin: 0,
  color: "#d0d5dd",
  lineHeight: 1.7,
};

const highlightsCardStyle = {
  display: "grid",
  gap: "0.8rem",
  padding: "1rem",
  borderRadius: "22px",
  border: "1px solid #d7dde7",
  backgroundColor: "#ffffff",
};

const highlightsEyebrowStyle = {
  margin: 0,
  color: "#475467",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  fontSize: "0.78rem",
};

const phaseGridStyle = {
  display: "grid",
  gap: "0.75rem",
};

const phaseCardStyle = {
  display: "grid",
  gap: "0.35rem",
  padding: "0.95rem",
  borderRadius: "16px",
  border: "1px solid #eaecf0",
  backgroundColor: "#f8fafc",
};

const phaseTitleStyle = {
  color: "#101828",
};

const phaseBodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.6,
};

const footerNoteStyle = {
  padding: "1rem 1.1rem",
  borderRadius: "16px",
  backgroundColor: "#101828",
  color: "#d0d5dd",
  lineHeight: 1.65,
};

export default EducationVideoSection;

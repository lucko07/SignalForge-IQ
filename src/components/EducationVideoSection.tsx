import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

type EducationVideoSectionProps = {
  title?: string;
  eyebrow?: string;
  captionsUrl?: string;
  posterUrl?: string;
  videoUrl?: string;
  ctaTo?: string;
  ctaLabel?: string;
};

const phasedHighlights = [
  {
    title: "Phase 1",
    description: "Manual signals, analytics, and performance tracking build the foundation.",
  },
  {
    title: "Phase 2",
    description: "Structured workflow and controlled automation expand what the system can do.",
  },
  {
    title: "Phase 3",
    description: "Alpaca paper trading lets you test safely before going live.",
  },
  {
    title: "Phase 4",
    description: "Live execution and advanced routing are enabled only when you are ready for that stage.",
  },
] as const;

function EducationVideoSection({
  title = "From signal clarity to controlled execution",
  eyebrow = "How It Works",
  captionsUrl,
  posterUrl,
  videoUrl,
  ctaTo = "/pricing",
  ctaLabel = "Explore Plans",
}: EducationVideoSectionProps) {
  const hasVideo = typeof videoUrl === "string" && videoUrl.trim().length > 0;
  const [hasVideoError, setHasVideoError] = useState(false);
  const shouldRenderVideo = hasVideo && !hasVideoError;
  const fallbackStyle = useMemo(() => ({
    ...placeholderStyle,
    ...(posterUrl
      ? {
        backgroundImage: `linear-gradient(135deg, rgba(16,24,40,0.82) 0%, rgba(23,32,51,0.72) 55%, rgba(33,55,83,0.82) 100%), url(${posterUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
      : null),
  }), [posterUrl]);

  return (
    <article style={outerShellStyle}>
      <div style={containerStyle}>
        <div style={headerGridStyle}>
          <div style={copyColumnStyle}>
            <p style={eyebrowStyle}>{eyebrow}</p>
            <h2 style={titleStyle}>{title}</h2>
            <p style={leadStyle}>
              SignalForge IQ helps traders move from scattered signals to a structured workflow.
              Start with manual signals, analytics, and performance tracking, then unlock controlled
              automation, safe testing, and advanced execution only when you are ready.
            </p>
          </div>

          <div style={ctaColumnStyle}>
            <div style={statusCardStyle}>
              <span style={statusPillStyle}>48-second explainer</span>
              <p style={statusBodyStyle}>
                Follow the product journey from signal clarity to safe testing and controlled
                execution, with each stage unlocked only when it fits the user&apos;s workflow.
              </p>
              <Link to={ctaTo} style={primaryLinkStyle}>
                {ctaLabel}
              </Link>
            </div>
          </div>
        </div>

        <div style={mediaGridStyle}>
        <div style={videoShellStyle}>
          {shouldRenderVideo ? (
            <>
              <video
                aria-label="SignalForge IQ product explainer video"
                autoPlay
                controls
                loop={false}
                muted
                playsInline
                poster={posterUrl}
                preload="metadata"
                style={videoPlayerStyle}
                onError={() => setHasVideoError(true)}
              >
                <source src={videoUrl} type="video/mp4" />
                {captionsUrl ? (
                  <track kind="captions" src={captionsUrl} srcLang="en" label="English" default />
                ) : null}
                Video unavailable. Learn how SignalForge IQ works below.
              </video>
              <p style={videoNoteStyle}>Start free today — and upgrade when you&apos;re ready.</p>
            </>
          ) : (
              <div style={fallbackStyle}>
                <div style={placeholderCenterStyle}>
                  <span style={placeholderBadgeStyle}>Video unavailable</span>
                  <h3 style={placeholderTitleStyle}>Video unavailable. Learn how SignalForge IQ works below.</h3>
                  <p style={placeholderBodyStyle}>
                    The explainer could not be loaded in this session, but the product rollout and
                    membership path are outlined below.
                  </p>
                  <Link to={ctaTo} style={fallbackLinkStyle}>
                    Compare Plans
                  </Link>
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
          The workflow begins with structure, moves through safe testing, and only reaches live
          execution when the user is ready for that next stage.
        </div>
      </div>
    </article>
  );
}

const outerShellStyle = {
  display: "grid",
  justifyItems: "center" as const,
};

const containerStyle = {
  display: "grid",
  gap: "1.25rem",
  width: "100%",
  maxWidth: "1120px",
  padding: "1.5rem",
  borderRadius: "24px",
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "radial-gradient(circle at top left, rgba(103, 131, 167, 0.22), transparent 22%), linear-gradient(180deg, #0f172a 0%, #111b2d 100%)",
  boxShadow: "0 16px 36px rgba(2, 6, 23, 0.28)",
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
  color: "#98a2b3",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  fontSize: "0.78rem",
};

const titleStyle = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "1.95rem",
};

const leadStyle = {
  margin: 0,
  color: "#f8fafc",
  lineHeight: 1.7,
  fontSize: "1.04rem",
  maxWidth: "62ch",
};

const statusCardStyle = {
  display: "grid",
  gap: "0.8rem",
  padding: "1rem",
  borderRadius: "18px",
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "rgba(255,255,255,0.04)",
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
  color: "#cbd5e1",
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
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "#0b1220",
  minHeight: "100%",
  boxShadow: "0 18px 36px rgba(2, 6, 23, 0.22)",
};

const videoPlayerStyle = {
  display: "block",
  width: "100%",
  height: "auto",
  minHeight: "320px",
  aspectRatio: "16 / 9",
};

const videoNoteStyle = {
  margin: 0,
  padding: "0.9rem 1rem",
  borderTop: "1px solid rgba(255,255,255,0.08)",
  backgroundColor: "rgba(255,255,255,0.03)",
  color: "#d0d5dd",
  lineHeight: 1.65,
};

const placeholderStyle = {
  display: "grid",
  placeItems: "center",
  minHeight: "320px",
  padding: "2rem",
  background:
    "linear-gradient(135deg, rgba(16,24,40,1) 0%, rgba(23,32,51,1) 55%, rgba(33,55,83,1) 100%)",
};

const fallbackLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  padding: "0.9rem 1.15rem",
  borderRadius: "12px",
  backgroundColor: "#ffffff",
  color: "#101828",
  fontWeight: 700,
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
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "rgba(255,255,255,0.04)",
};

const highlightsEyebrowStyle = {
  margin: 0,
  color: "#98a2b3",
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
  border: "1px solid rgba(255,255,255,0.08)",
  backgroundColor: "rgba(255,255,255,0.03)",
};

const phaseTitleStyle = {
  color: "#f8fafc",
};

const phaseBodyStyle = {
  margin: 0,
  color: "#cbd5e1",
  lineHeight: 1.6,
};

const footerNoteStyle = {
  padding: "1rem 1.1rem",
  borderRadius: "16px",
  backgroundColor: "rgba(255,255,255,0.05)",
  color: "#d0d5dd",
  lineHeight: 1.65,
};

export default EducationVideoSection;

type MetricCardProps = {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "warning";
  helper?: string;
};

const toneStyles = {
  default: { border: "1px solid #1f2937", backgroundColor: "#111827", accent: "#93c5fd" },
  positive: { border: "1px solid #14532d", backgroundColor: "#052e16", accent: "#86efac" },
  negative: { border: "1px solid #7f1d1d", backgroundColor: "#450a0a", accent: "#fca5a5" },
  warning: { border: "1px solid #78350f", backgroundColor: "#451a03", accent: "#fcd34d" },
} as const;

function MetricCard({ label, value, tone = "default", helper }: MetricCardProps) {
  const palette = toneStyles[tone];

  return (
    <article
      style={{
        display: "grid",
        gap: "0.45rem",
        padding: "1rem",
        borderRadius: "18px",
        border: palette.border,
        backgroundColor: palette.backgroundColor,
        color: "#f9fafb",
        boxShadow: "0 20px 30px rgba(2, 6, 23, 0.22)",
      }}
    >
      <span style={{ color: "#9ca3af", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </span>
      <strong style={{ fontSize: "1.8rem", color: palette.accent }}>{value}</strong>
      {helper ? <span style={{ color: "#cbd5e1", fontSize: "0.92rem" }}>{helper}</span> : null}
    </article>
  );
}

export default MetricCard;

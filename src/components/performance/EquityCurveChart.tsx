import type { ReactNode } from "react";
import type { EquityCurvePoint } from "../../types/performance";

type EquityCurveChartProps = {
  points: EquityCurvePoint[];
};

function EquityCurveChart({ points }: EquityCurveChartProps) {
  if (points.length === 0) {
    return <EmptyChartState label="No closed trades yet for the equity curve." />;
  }

  const values = points.map((point) => point.cumulativeR);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1;
  const width = 640;
  const height = 260;

  const path = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - (((point.cumulativeR - minValue) / range) * height);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <ChartShell title="Equity Curve" subtitle="Cumulative R by completed trade">
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "260px" }}>
        <defs>
          <linearGradient id="equity-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(34,197,94,0.35)" />
            <stop offset="100%" stopColor="rgba(34,197,94,0.02)" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} rx="18" fill="#020617" />
        <path d={path} fill="none" stroke="#4ade80" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </ChartShell>
  );
}

function ChartShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <article
      style={{
        display: "grid",
        gap: "0.75rem",
        padding: "1rem",
        borderRadius: "20px",
        border: "1px solid #1f2937",
        backgroundColor: "#0f172a",
      }}
    >
      <div>
        <h3 style={{ margin: 0, color: "#f8fafc" }}>{title}</h3>
        <p style={{ margin: "0.3rem 0 0", color: "#94a3b8" }}>{subtitle}</p>
      </div>
      {children}
    </article>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <ChartShell title="Equity Curve" subtitle="Cumulative R by completed trade">
      <div
        style={{
          minHeight: "260px",
          display: "grid",
          placeItems: "center",
          borderRadius: "18px",
          border: "1px dashed #334155",
          color: "#94a3b8",
        }}
      >
        {label}
      </div>
    </ChartShell>
  );
}

export default EquityCurveChart;

import type { ChartPoint } from "../../types/performance";

type DailyNetRChartProps = {
  points: ChartPoint[];
};

function DailyNetRChart({ points }: DailyNetRChartProps) {
  if (points.length === 0) {
    return (
      <article style={chartShellStyle}>
        <div>
          <h3 style={chartTitleStyle}>Daily Net R</h3>
          <p style={chartSubtitleStyle}>No daily trade outcomes yet.</p>
        </div>
        <div style={emptyChartStyle}>Daily performance will appear here after trades close.</div>
      </article>
    );
  }

  const width = 640;
  const height = 260;
  const maxMagnitude = Math.max(...points.map((point) => Math.abs(point.value)), 1);
  const barWidth = width / Math.max(points.length, 1);
  const zeroY = height / 2;

  return (
    <article style={chartShellStyle}>
      <div>
        <h3 style={chartTitleStyle}>Daily Net R</h3>
        <p style={chartSubtitleStyle}>Aggregated R by day</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "260px" }}>
        <rect width={width} height={height} rx="18" fill="#020617" />
        <line x1="0" x2={width} y1={zeroY} y2={zeroY} stroke="#1e293b" strokeWidth="1.5" />
        {points.map((point, index) => {
          const scaledHeight = (Math.abs(point.value) / maxMagnitude) * (height * 0.42);
          const x = index * barWidth + (barWidth * 0.18);
          const y = point.value >= 0 ? zeroY - scaledHeight : zeroY;
          const fill = point.value >= 0 ? "#38bdf8" : "#f97316";

          return (
            <rect
              key={`${point.label}-${index}`}
              x={x}
              y={y}
              width={barWidth * 0.64}
              height={scaledHeight}
              rx="8"
              fill={fill}
            />
          );
        })}
      </svg>
    </article>
  );
}

const chartShellStyle = {
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
  borderRadius: "20px",
  border: "1px solid #1f2937",
  backgroundColor: "#0f172a",
};

const chartTitleStyle = {
  margin: 0,
  color: "#f8fafc",
};

const chartSubtitleStyle = {
  margin: "0.3rem 0 0",
  color: "#94a3b8",
};

const emptyChartStyle = {
  minHeight: "260px",
  display: "grid",
  placeItems: "center",
  borderRadius: "18px",
  border: "1px dashed #334155",
  color: "#94a3b8",
};

export default DailyNetRChart;

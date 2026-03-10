import type { Signal } from "../lib/firestore";

type SignalCardProps = {
  signal: Signal;
};

function SignalCard({ signal }: SignalCardProps) {
  return (
    <article
      style={{
        padding: "1.25rem",
        border: "1px solid #d0d5dd",
        borderRadius: "16px",
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 2px rgba(16, 24, 40, 0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "0.75rem",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#101828" }}>
            {signal.symbol}
          </h2>
          <p style={{ margin: "0.25rem 0 0" }}>{signal.assetType}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <span
            style={{
              padding: "0.35rem 0.7rem",
              borderRadius: "999px",
              backgroundColor:
                signal.direction.toUpperCase() === "LONG" ? "#ecfdf3" : "#fef3f2",
              color:
                signal.direction.toUpperCase() === "LONG" ? "#027a48" : "#b42318",
              fontWeight: 700,
              fontSize: "0.85rem",
            }}
          >
            {signal.direction}
          </span>
          <span
            style={{
              padding: "0.35rem 0.7rem",
              borderRadius: "999px",
              backgroundColor: "#f2f4f7",
              color: "#344054",
              fontWeight: 700,
              fontSize: "0.85rem",
            }}
          >
            {signal.status}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.75rem",
          marginBottom: "0.9rem",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: "0.85rem" }}>Entry</p>
          <strong>{signal.entry}</strong>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "0.85rem" }}>Stop Loss</p>
          <strong>{signal.stopLoss}</strong>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "0.85rem" }}>Target</p>
          <strong>{signal.target}</strong>
        </div>
      </div>

      <div>
        <p style={{ margin: "0 0 0.35rem", fontSize: "0.85rem" }}>Thesis</p>
        <p style={{ margin: 0 }}>{signal.thesis}</p>
      </div>
    </article>
  );
}

export default SignalCard;

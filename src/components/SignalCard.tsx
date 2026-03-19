import type { Signal } from "../lib/firestore";

type SignalCardProps = {
  signal: Signal;
};

function SignalCard({ signal }: SignalCardProps) {
  const createdAtLabel = formatSignalDate(signal.createdAt);
  const closedAtLabel = formatSignalDate(signal.closedAt);
  const sourceLabel = formatSourceLabel(signal.source);
  const pnlLabel =
    typeof signal.pnlPercent === "number"
      ? `${signal.pnlPercent > 0 ? "+" : ""}${signal.pnlPercent.toFixed(2)}%`
      : "";

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
          <p style={{ margin: "0.25rem 0 0", color: "#475467" }}>{signal.assetType}</p>
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
              backgroundColor: getStatusBadgeBackground(signal.status),
              color: getStatusBadgeColor(signal.status),
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
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "0.9rem",
          color: "#667085",
          fontSize: "0.85rem",
        }}
      >
        {createdAtLabel ? <MetadataPill label={`Created ${createdAtLabel}`} /> : null}
        {closedAtLabel ? <MetadataPill label={`Closed ${closedAtLabel}`} /> : null}
        {sourceLabel ? <MetadataPill label={`Source ${sourceLabel}`} /> : null}
        <MetadataPill label={`Status ${signal.status}`} />
        {signal.outcome ? <MetadataPill label={`Outcome ${signal.outcome}`} /> : null}
        {pnlLabel ? <MetadataPill label={`PnL ${pnlLabel}`} /> : null}
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
        {signal.exitPrice ? (
          <div>
            <p style={{ margin: 0, fontSize: "0.85rem" }}>Exit Price</p>
            <strong>{signal.exitPrice}</strong>
          </div>
        ) : null}
      </div>

      {signal.outcome || signal.exitReason || typeof signal.rrResult === "number" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "0.75rem",
            marginBottom: "0.9rem",
          }}
        >
          {signal.outcome ? (
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>Outcome</p>
              <strong>{signal.outcome}</strong>
            </div>
          ) : null}
          {signal.exitReason ? (
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>Exit Reason</p>
              <strong>{signal.exitReason}</strong>
            </div>
          ) : null}
          {typeof signal.rrResult === "number" ? (
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>R:R Result</p>
              <strong>{signal.rrResult.toFixed(2)}R</strong>
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <p style={{ margin: "0 0 0.35rem", fontSize: "0.85rem" }}>Thesis</p>
        <p style={{ margin: 0 }}>{signal.thesis}</p>
      </div>
    </article>
  );
}

type MetadataPillProps = {
  label: string;
};

function MetadataPill({ label }: MetadataPillProps) {
  return (
    <span
      style={{
        padding: "0.35rem 0.65rem",
        borderRadius: "999px",
        backgroundColor: "#f8fafc",
        border: "1px solid #eaecf0",
        color: "#475467",
      }}
    >
      {label}
    </span>
  );
}

function formatSourceLabel(source?: string) {
  const normalizedSource = source?.trim();

  if (!normalizedSource) {
    return "";
  }

  if (normalizedSource.toLowerCase() === "webhook") {
    return "Automated";
  }

  return normalizedSource;
}

const formatSignalDate = (value: unknown) => {
  if (!value) {
    return "";
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(value.toDate());
  }

  const parsedDate = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
};

const getStatusBadgeBackground = (status: string) => {
  const normalizedStatus = status.trim().toUpperCase();

  if (normalizedStatus === "ACTIVE") {
    return "#ecfdf3";
  }

  if (normalizedStatus === "PENDING") {
    return "#fffaeb";
  }

  if (normalizedStatus === "TAKE_PROFIT") {
    return "#eff8ff";
  }

  if (normalizedStatus === "STOPPED") {
    return "#fef3f2";
  }

  if (normalizedStatus === "CLOSED") {
    return "#f2f4f7";
  }

  if (normalizedStatus === "CANCELLED") {
    return "#fff1f3";
  }

  return "#f2f4f7";
};

const getStatusBadgeColor = (status: string) => {
  const normalizedStatus = status.trim().toUpperCase();

  if (normalizedStatus === "ACTIVE") {
    return "#027a48";
  }

  if (normalizedStatus === "PENDING") {
    return "#b54708";
  }

  if (normalizedStatus === "TAKE_PROFIT") {
    return "#175cd3";
  }

  if (normalizedStatus === "STOPPED") {
    return "#b42318";
  }

  if (normalizedStatus === "CLOSED") {
    return "#344054";
  }

  if (normalizedStatus === "CANCELLED") {
    return "#c11574";
  }

  return "#344054";
};

export default SignalCard;

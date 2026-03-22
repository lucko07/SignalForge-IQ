type TradingDisclaimerProps = {
  compact?: boolean;
};

const disclaimerText =
  "SignalForge IQ provides trading signals, market insights, and educational content for informational use only. Nothing on this site is financial, investment, legal, or tax advice. Markets involve risk, results are not guaranteed, and you remain solely responsible for your own decisions, trades, and outcomes.";

function TradingDisclaimer({ compact = false }: TradingDisclaimerProps) {
  return (
    <div style={compact ? compactContainerStyle : cardContainerStyle}>
      <strong style={titleStyle}>Trading Disclaimer</strong>
      <p style={compact ? compactBodyStyle : bodyStyle}>{disclaimerText}</p>
    </div>
  );
}

const cardContainerStyle = {
  display: "grid",
  gap: "0.45rem",
  padding: "1rem 1.1rem",
  borderRadius: "16px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#f8fafc",
};

const compactContainerStyle = {
  display: "grid",
  gap: "0.35rem",
  maxWidth: "720px",
};

const titleStyle = {
  color: "#101828",
  fontSize: "0.95rem",
};

const bodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.65,
};

const compactBodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.6,
  fontSize: "0.92rem",
};

export default TradingDisclaimer;

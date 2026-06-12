import type { ReactNode } from "react";
import "./MarketingAssetsPage.css";
import BrandLogo from "../components/BrandLogo";

type Tone = "accent" | "positive" | "warning" | "neutral";

type DashboardMetric = {
  label: string;
  value: string;
  helper: string;
  tone: Tone;
};

type EngineHealth = {
  name: string;
  status: string;
  score: number;
  detail: string;
};

type WatchlistItem = {
  symbol: string;
  bias: string;
  detail: string;
  change: string;
  tone: "positive" | "negative" | "neutral";
};

type DemoSignal = {
  symbol: string;
  side: "Long" | "Short";
  entry: string;
  stop: string;
  target: string;
  status: string;
  tone: Tone;
  strategy: string;
  timeframe: string;
  thesis: string;
};

type AuditEvent = {
  title: string;
  time: string;
  detail: string;
  label: string;
  tone: Tone;
};

type PerformanceHighlight = {
  label: string;
  value: string;
  helper: string;
  tone: Tone;
};

type CurvePoint = {
  label: string;
  value: number;
};

const dashboardMetrics: DashboardMetric[] = [
  {
    label: "Live Signals",
    value: "03",
    helper: "High-conviction setups active",
    tone: "accent",
  },
  {
    label: "Win Rate",
    value: "64.2%",
    helper: "Trailing 30 closed trades",
    tone: "positive",
  },
  {
    label: "Net PnL",
    value: "+18.4%",
    helper: "Demo equity sample",
    tone: "accent",
  },
  {
    label: "Sync Lag",
    value: "0.4s",
    helper: "Signal to audit log",
    tone: "warning",
  },
];

const engineHealth: EngineHealth[] = [
  {
    name: "BTC Precision Engine",
    status: "Online",
    score: 96,
    detail: "Selective trend continuation model",
  },
  {
    name: "BTC Continuation Engine",
    status: "Tracking",
    score: 92,
    detail: "Momentum filter and session bias aligned",
  },
  {
    name: "Risk Sync Layer",
    status: "Healthy",
    score: 99,
    detail: "Stops, targets, and lifecycle logging matched",
  },
];

const watchlistItems: WatchlistItem[] = [
  {
    symbol: "BTCUSD",
    bias: "Bullish structure",
    detail: "Reclaimed range high and held the retest above VWAP.",
    change: "+1.9%",
    tone: "positive",
  },
  {
    symbol: "BTCUSD",
    bias: "Compression watch",
    detail: "Trend still constructive while volume compresses into resistance.",
    change: "+0.7%",
    tone: "neutral",
  },
  {
    symbol: "SOLUSD",
    bias: "Momentum risk",
    detail: "Pullback into prior breakout zone with rising relative strength.",
    change: "-0.4%",
    tone: "negative",
  },
];

const demoSignals: DemoSignal[] = [
  {
    symbol: "BTCUSD",
    side: "Long",
    entry: "68,420",
    stop: "67,680",
    target: "69,890",
    status: "Live",
    tone: "accent",
    strategy: "BTC Precision Engine",
    timeframe: "30m",
    thesis: "Breakout reclaim above New York session range with clean momentum continuation.",
  },
  {
    symbol: "BTCUSD",
    side: "Short",
    entry: "3,216",
    stop: "3,278",
    target: "3,092",
    status: "Tracking",
    tone: "warning",
    strategy: "BTC Continuation Engine",
    timeframe: "15m",
    thesis: "Failed reclaim under resistance produced a measured pullback short with defined risk.",
  },
  {
    symbol: "SOLUSD",
    side: "Long",
    entry: "148.20",
    stop: "144.60",
    target: "156.90",
    status: "Target 1",
    tone: "positive",
    strategy: "Momentum Watch",
    timeframe: "1h",
    thesis: "Higher-low retest held with expanding participation and room toward prior supply.",
  },
];

const auditEvents: AuditEvent[] = [
  {
    title: "Signal Detected",
    time: "09:14:08 NY",
    detail: "BTC Precision Engine validated market structure, risk, and confluence filters.",
    label: "Qualified setup",
    tone: "accent",
  },
  {
    title: "Trade Executed",
    time: "09:14:19 NY",
    detail: "Entry, stop, and target were stamped into the execution layer with static demo routing.",
    label: "Order confirmed",
    tone: "positive",
  },
  {
    title: "Position Tracked",
    time: "09:31:42 NY",
    detail: "Live monitoring captured excursion, stop drift checks, and milestone updates.",
    label: "Position monitored",
    tone: "accent",
  },
  {
    title: "Trade Closed",
    time: "10:08:57 NY",
    detail: "Position exited at target after measured continuation through the morning range.",
    label: "Outcome locked",
    tone: "positive",
  },
  {
    title: "Result Logged",
    time: "10:09:02 NY",
    detail: "PnL, lifecycle timestamps, and audit metadata were appended to the final record.",
    label: "Append-only audit",
    tone: "neutral",
  },
];

const performanceHighlights: PerformanceHighlight[] = [
  {
    label: "Net Return",
    value: "+18.4%",
    helper: "Trailing demo sample",
    tone: "accent",
  },
  {
    label: "Profit Factor",
    value: "1.92",
    helper: "Wins over losses",
    tone: "positive",
  },
  {
    label: "Max Drawdown",
    value: "-2.8R",
    helper: "Contained pullback",
    tone: "warning",
  },
  {
    label: "Avg Trade",
    value: "+0.61R",
    helper: "30 closed positions",
    tone: "neutral",
  },
];

const performanceCurve: CurvePoint[] = [
  { label: "T1", value: 0.2 },
  { label: "T3", value: 0.7 },
  { label: "T5", value: 1.4 },
  { label: "T7", value: 1.2 },
  { label: "T9", value: 2.1 },
  { label: "T11", value: 2.8 },
  { label: "T13", value: 3.4 },
  { label: "T15", value: 3.1 },
  { label: "T17", value: 4.2 },
  { label: "T19", value: 4.9 },
  { label: "T21", value: 5.5 },
  { label: "T23", value: 5.2 },
  { label: "T25", value: 6.4 },
  { label: "T27", value: 7.1 },
  { label: "T30", value: 7.8 },
];

const monthlyPerformance = [
  { label: "Jan", value: "+2.4R" },
  { label: "Feb", value: "+3.1R" },
  { label: "Mar", value: "+2.8R" },
  { label: "Apr", value: "+4.2R" },
];

function MarketingAssetsPage() {
  return (
    <div className="marketing-assets-page" data-theme="dark">
      <div className="marketing-assets-page__content">
        <header className="marketing-assets-page__hero">
          <div className="marketing-assets-page__hero-copy">
            <BrandLogo variant="full" />
            <p className="marketing-assets-page__eyebrow">Marketing Capture Route</p>
            <h1 className="marketing-assets-page__title">Four portrait-ready SignalForge IQ product visuals.</h1>
            <p className="marketing-assets-page__body">
              Static demo data only. This route does not use Firestore, Stripe, Alpaca,
              Firebase Auth, or any live backend data.
            </p>
          </div>

          <nav aria-label="Marketing capture sections" className="marketing-assets-page__nav">
            <a href="#dashboard-overview">Dashboard</a>
            <a href="#signal-cards">Signal Cards</a>
            <a href="#activity-audit-log">Activity Log</a>
            <a href="#performance-chart">Performance Chart</a>
          </nav>
        </header>

        <CaptureSection
          id="dashboard-overview"
          number="01"
          title="Dashboard Overview"
          description="Premium command-center snapshot with visible key metrics and operational status."
        >
          <DashboardOverviewShot />
        </CaptureSection>

        <CaptureSection
          id="signal-cards"
          number="02"
          title="Signal Cards"
          description="Multiple live demo signal cards with symbol, side, entry, stop, target, and status."
        >
          <SignalCardsShot />
        </CaptureSection>

        <CaptureSection
          id="activity-audit-log"
          number="03"
          title="Activity Audit Log"
          description="Lifecycle events arranged to clearly tell the story: Signal to trade to outcome to logged."
        >
          <ActivityAuditLogShot />
        </CaptureSection>

        <CaptureSection
          id="performance-chart"
          number="04"
          title="Performance Chart"
          description="Clean trend-focused performance view with realistic demo metrics and an equity curve."
        >
          <PerformanceChartShot />
        </CaptureSection>
      </div>
    </div>
  );
}

type CaptureSectionProps = {
  id: string;
  number: string;
  title: string;
  description: string;
  children: ReactNode;
};

function CaptureSection({ id, number, title, description, children }: CaptureSectionProps) {
  return (
    <section id={id} className="marketing-section">
      <div className="marketing-section__meta">
        <div className="marketing-section__title-wrap">
          <span className="marketing-section__index">{number}</span>
          <div>
            <h2 className="marketing-section__title">{title}</h2>
            <p className="marketing-section__description">{description}</p>
          </div>
        </div>
        <p className="marketing-section__capture-note">Crop inside the rounded portrait frame for a clean 9:16 shot.</p>
      </div>

      <div className="marketing-section__stage">
        <div className="marketing-frame">{children}</div>
      </div>
    </section>
  );
}

function DashboardOverviewShot() {
  return (
    <div className="marketing-frame__canvas">
      <FrameHeader contextLabel="Dashboard Overview" />
      <ShotTitle
        eyebrow="Command Center"
        title="One premium dashboard for signal health, risk pacing, and performance."
      />

      <section className="marketing-hero-card">
        <div>
          <p className="marketing-hero-card__eyebrow">Realtime Snapshot</p>
          <h3 className="marketing-hero-card__title">Selective engines online and waiting for high-conviction structure.</h3>
          <p className="marketing-hero-card__body">
            BTC models are active, the audit trail is synchronized, and the feed
            remains intentionally selective to avoid low-quality trade flow.
          </p>
        </div>
        <div className="marketing-chip-row">
          <span className="marketing-chip marketing-chip--accent">3 engines online</span>
          <span className="marketing-chip marketing-chip--positive">64.2% win rate</span>
          <span className="marketing-chip marketing-chip--neutral">0.4s audit sync</span>
        </div>
      </section>

      <div className="marketing-kpi-grid">
        {dashboardMetrics.map((metric) => (
          <KpiCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="marketing-dashboard-grid">
        <article className="marketing-panel">
          <PanelHeader title="Engine Health" pill="3 online" />
          <div className="marketing-engine-list">
            {engineHealth.map((engine) => (
              <div key={engine.name} className="marketing-engine-row">
                <div className="marketing-engine-row__copy">
                  <div className="marketing-engine-row__topline">
                    <strong>{engine.name}</strong>
                    <span>{engine.status}</span>
                  </div>
                  <p>{engine.detail}</p>
                </div>
                <div className="marketing-engine-row__bar">
                  <span style={{ width: `${engine.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="marketing-panel">
          <PanelHeader title="Focus List" pill="3 symbols" />
          <div className="marketing-watchlist">
            {watchlistItems.map((item) => (
              <div key={item.symbol} className="marketing-watchlist__row">
                <div>
                  <div className="marketing-watchlist__topline">
                    <strong>{item.symbol}</strong>
                    <span className={`marketing-change marketing-change--${item.tone}`}>{item.change}</span>
                  </div>
                  <p>{item.bias}</p>
                  <small>{item.detail}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}

function SignalCardsShot() {
  return (
    <div className="marketing-frame__canvas">
      <FrameHeader contextLabel="Signal Cards" />
      <ShotTitle
        eyebrow="Live Feed"
        title="Multiple live signal cards with realistic demo entries, stops, targets, and status."
      />

      <div className="marketing-signal-stack">
        {demoSignals.map((signal) => (
          <article key={signal.symbol} className="marketing-signal-card">
            <div className="marketing-signal-card__header">
              <div>
                <h3 className="marketing-signal-card__symbol">{signal.symbol}</h3>
                <p className="marketing-signal-card__meta">
                  {signal.strategy} - {signal.timeframe}
                </p>
              </div>

              <div className="marketing-signal-card__chips">
                <span className={`marketing-chip ${signal.side === "Long" ? "marketing-chip--positive" : "marketing-chip--warning"}`}>
                  {signal.side}
                </span>
                <span className={`marketing-chip marketing-chip--${signal.tone}`}>{signal.status}</span>
              </div>
            </div>

            <div className="marketing-signal-card__stats">
              <SignalStat label="Entry" value={signal.entry} />
              <SignalStat label="Stop" value={signal.stop} />
              <SignalStat label="Target" value={signal.target} />
              <SignalStat label="Status" value={signal.status} />
            </div>

            <p className="marketing-signal-card__thesis">{signal.thesis}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function ActivityAuditLogShot() {
  return (
    <div className="marketing-frame__canvas">
      <FrameHeader contextLabel="Activity Audit Log" />
      <ShotTitle
        eyebrow="Lifecycle Audit"
        title="Signal -> Trade -> Outcome -> Logged"
      />

      <div className="marketing-flow-banner">
        <span>Signal</span>
        <span>Trade</span>
        <span>Outcome</span>
        <span>Logged</span>
      </div>

      <div className="marketing-timeline">
        {auditEvents.map((event) => (
          <article key={event.title} className="marketing-timeline__item">
            <div className={`marketing-timeline__dot marketing-timeline__dot--${event.tone}`} />
            <div className="marketing-timeline__content">
              <div className="marketing-timeline__header">
                <strong>{event.title}</strong>
                <span>{event.time}</span>
              </div>
              <p>{event.detail}</p>
              <span className={`marketing-chip marketing-chip--${event.tone}`}>{event.label}</span>
            </div>
          </article>
        ))}
      </div>

      <article className="marketing-panel marketing-panel--compact">
        <PanelHeader title="Audit Integrity" pill="Append-only" />
        <div className="marketing-summary-strip">
          <SummaryTile label="Event Sync" value="Healthy" />
          <SummaryTile label="Execution Lag" value="0.4s" />
          <SummaryTile label="Record Match" value="100%" />
        </div>
      </article>
    </div>
  );
}

function PerformanceChartShot() {
  return (
    <div className="marketing-frame__canvas">
      <FrameHeader contextLabel="Performance Chart" />
      <ShotTitle
        eyebrow="Performance Center"
        title="A clean, professional equity curve with drawdown context and performance metrics."
      />

      <div className="marketing-kpi-grid marketing-kpi-grid--compact">
        {performanceHighlights.map((highlight) => (
          <KpiCard key={highlight.label} {...highlight} />
        ))}
      </div>

      <article className="marketing-panel marketing-panel--chart">
        <PanelHeader title="Equity Curve" pill="30 closed trades" />
        <p className="marketing-panel__subtitle">Demo sample showing steady net growth with controlled pullbacks.</p>
        <PerformanceCurve points={performanceCurve} />
      </article>

      <div className="marketing-performance-strip">
        {monthlyPerformance.map((month) => (
          <SummaryTile key={month.label} label={month.label} value={month.value} />
        ))}
      </div>
    </div>
  );
}

function FrameHeader({ contextLabel }: { contextLabel: string }) {
  return (
    <header className="marketing-frame__header">
      <BrandLogo variant="compact" />
      <div className="marketing-frame__header-chips">
        <span className="marketing-chip marketing-chip--neutral">Static Demo</span>
        <span className="marketing-chip marketing-chip--accent">{contextLabel}</span>
      </div>
    </header>
  );
}

function ShotTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="marketing-shot-title">
      <p className="marketing-shot-title__eyebrow">{eyebrow}</p>
      <h2 className="marketing-shot-title__title">{title}</h2>
    </div>
  );
}

function PanelHeader({ title, pill }: { title: string; pill: string }) {
  return (
    <div className="marketing-panel__header">
      <h3>{title}</h3>
      <span className="marketing-chip marketing-chip--neutral">{pill}</span>
    </div>
  );
}

function KpiCard({ label, value, helper, tone }: DashboardMetric | PerformanceHighlight) {
  return (
    <article className={`marketing-kpi-card marketing-kpi-card--${tone}`}>
      <span className="marketing-kpi-card__label">{label}</span>
      <strong className="marketing-kpi-card__value">{value}</strong>
      <span className="marketing-kpi-card__helper">{helper}</span>
    </article>
  );
}

function SignalStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="marketing-signal-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="marketing-summary-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PerformanceCurve({ points }: { points: CurvePoint[] }) {
  const width = 468;
  const height = 248;
  const paddingX = 18;
  const paddingTop = 20;
  const paddingBottom = 28;
  const minValue = Math.min(...points.map((point) => point.value));
  const maxValue = Math.max(...points.map((point) => point.value));
  const range = maxValue - minValue || 1;
  const usableWidth = width - (paddingX * 2);
  const usableHeight = height - paddingTop - paddingBottom;
  const baselineY = height - paddingBottom;

  const coordinates = points.map((point, index) => {
    const x = paddingX + ((usableWidth * index) / Math.max(points.length - 1, 1));
    const y = baselineY - (((point.value - minValue) / range) * usableHeight);

    return {
      ...point,
      x,
      y,
    };
  });

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1].x} ${baselineY} L ${coordinates[0].x} ${baselineY} Z`;
  const midpoint = coordinates[Math.floor(coordinates.length / 2)];
  const lastPoint = coordinates[coordinates.length - 1];

  return (
    <div className="marketing-curve">
      <svg viewBox={`0 0 ${width} ${height}`} aria-label="Performance equity curve" className="marketing-curve__svg">
        <defs>
          <linearGradient id="marketing-curve-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(34, 211, 238, 0.38)" />
            <stop offset="100%" stopColor="rgba(34, 211, 238, 0.03)" />
          </linearGradient>
          <linearGradient id="marketing-curve-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} rx="22" fill="#07111f" />
        {[0, 1, 2, 3].map((row) => {
          const y = paddingTop + ((usableHeight * row) / 3);

          return (
            <line
              key={row}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              stroke="rgba(148, 163, 184, 0.16)"
              strokeWidth="1"
            />
          );
        })}

        <path d={areaPath} fill="url(#marketing-curve-fill)" />
        <path d={linePath} fill="none" stroke="url(#marketing-curve-line)" strokeWidth="4" strokeLinecap="round" />

        {coordinates.filter((_, index) => index % 4 === 0).map((point) => (
          <circle
            key={point.label}
            cx={point.x}
            cy={point.y}
            r="3.5"
            fill="#07111f"
            stroke="#67e8f9"
            strokeWidth="2"
          />
        ))}

        <circle cx={lastPoint.x} cy={lastPoint.y} r="6" fill="#22d3ee" />
      </svg>

      <div className="marketing-curve__labels">
        <span>{coordinates[0].label}</span>
        <span>{midpoint.label}</span>
        <span>{lastPoint.label}</span>
      </div>
    </div>
  );
}

export default MarketingAssetsPage;

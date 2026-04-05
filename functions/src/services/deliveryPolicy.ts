export type DeliveryPlan = "pro" | "elite" | "platinum";

export type DeliveryPolicy = {
  plan: DeliveryPlan;
  label: string;
  maxAttempts: number;
  initialBackoffSeconds: number;
  maxBackoffSeconds: number;
  backoffMultiplier: number;
  requestTimeoutMs: number;
  batchSize: number;
  jitterRatio: number;
  priority: number;
};

const DELIVERY_POLICIES: Record<DeliveryPlan, DeliveryPolicy> = {
  pro: {
    plan: "pro",
    label: "Pro",
    maxAttempts: 5,
    initialBackoffSeconds: 30,
    maxBackoffSeconds: 15 * 60,
    backoffMultiplier: 2,
    requestTimeoutMs: 8_000,
    batchSize: 25,
    jitterRatio: 0.15,
    priority: 1,
  },
  elite: {
    plan: "elite",
    label: "Elite",
    maxAttempts: 7,
    initialBackoffSeconds: 15,
    maxBackoffSeconds: 10 * 60,
    backoffMultiplier: 2,
    requestTimeoutMs: 10_000,
    batchSize: 50,
    jitterRatio: 0.1,
    priority: 2,
  },
  platinum: {
    plan: "platinum",
    label: "Platinum",
    maxAttempts: 9,
    initialBackoffSeconds: 5,
    maxBackoffSeconds: 5 * 60,
    backoffMultiplier: 2,
    requestTimeoutMs: 12_000,
    batchSize: 100,
    jitterRatio: 0.05,
    priority: 3,
  },
};

export const normalizeDeliveryPlan = (value: unknown): DeliveryPlan => {
  if (typeof value !== "string") {
    return "pro";
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "platinum") {
    return "platinum";
  }

  if (normalizedValue === "elite") {
    return "elite";
  }

  return "pro";
};

export const getDeliveryPolicy = (plan: unknown): DeliveryPolicy => {
  const normalizedPlan = normalizeDeliveryPlan(plan);
  return DELIVERY_POLICIES[normalizedPlan];
};

export const getNextRetryDelaySeconds = (
  policy: DeliveryPolicy,
  attemptNumber: number,
  randomValue = Math.random()
) => {
  const safeAttemptNumber = Math.max(1, Math.floor(attemptNumber));
  const exponentialDelay =
    policy.initialBackoffSeconds * Math.pow(policy.backoffMultiplier, safeAttemptNumber - 1);
  const cappedDelay = Math.min(exponentialDelay, policy.maxBackoffSeconds);
  const boundedRandomValue = Math.min(1, Math.max(0, randomValue));
  const jitterOffset =
    cappedDelay * policy.jitterRatio * (boundedRandomValue * 2 - 1);

  return Math.max(1, Math.round(cappedDelay + jitterOffset));
};

export const isFinalDeliveryAttempt = (policy: DeliveryPolicy, attemptNumber: number) =>
  attemptNumber >= policy.maxAttempts;

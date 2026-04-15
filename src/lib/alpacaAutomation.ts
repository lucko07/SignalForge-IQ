import { httpsCallable } from "firebase/functions";
import type { FunctionsError } from "firebase/functions";
import { functions } from "./firebase";
import type { AutomationSettings } from "./automationFirestore";

type TestAlpacaConnectionResponse = {
  ok: boolean;
  provider: "alpaca";
  mode: "paper";
  account: {
    id: string | null;
    accountNumber: string | null;
    status: string;
    currency: string;
    buyingPower: string;
    cash: string;
    portfolioValue: string;
    cryptoStatus: string | null;
    tradingBlocked: boolean;
    transfersBlocked: boolean;
    accountBlocked: boolean;
  };
};

type SaveAlpacaPaperAutomationSettingsPayload = {
  enabled?: boolean;
  killSwitch?: boolean;
  longsEnabled?: boolean;
  shortsEnabled?: boolean;
  notionalUsd?: number;
  symbolAllowlist?: string[];
  maxOpenPositions?: number;
  maxTradesPerDay?: number;
};

type SaveAlpacaPaperAutomationSettingsResponse = {
  ok: boolean;
  settings: AutomationSettings;
};

export type RunAdminPaperExecutionTestResponse = {
  ok?: boolean;
  tradeId?: string;
  executionId?: string;
  validation?: {
    eligible?: boolean;
    reason?: string;
  };
  execution?: {
    status?: string;
    skipped?: boolean;
    submitted?: boolean;
    reason?: string | null;
    alpacaOrderId?: string | null;
  };
  tradeCreated?: boolean;
  reusedTrade?: boolean;
};

type RunAdminPaperExecutionTestPayload = {
  tradeId?: string;
};

const testAlpacaConnectionCallable = httpsCallable<undefined, TestAlpacaConnectionResponse>(
  functions,
  "testAlpacaConnection"
);

const saveAlpacaPaperAutomationSettingsCallable = httpsCallable<
  SaveAlpacaPaperAutomationSettingsPayload,
  SaveAlpacaPaperAutomationSettingsResponse
>(
  functions,
  "saveAlpacaPaperAutomationSettings"
);

const runAdminPaperExecutionTestCallable = httpsCallable<
  RunAdminPaperExecutionTestPayload,
  RunAdminPaperExecutionTestResponse
>(
  functions,
  "runAdminPaperExecutionTest"
);

const getAdminAutomationErrorMessage = (error: unknown) => {
  const code = (error as FunctionsError | undefined)?.code;

  switch (code) {
    case "functions/permission-denied":
      return "Only admins can manage Alpaca paper automation.";
    case "functions/unauthenticated":
      return "Sign in to manage Alpaca paper automation.";
    case "functions/invalid-argument":
      return "Review the Alpaca paper settings and try again.";
    case "functions/not-found":
      return "Your user profile could not be found.";
    case "functions/resource-exhausted":
      return "Too many attempts. Please wait and try again.";
    default:
      return "Unable to complete the Alpaca paper automation action right now.";
  }
};

export const testAlpacaConnection = async () => {
  try {
    const response = await testAlpacaConnectionCallable();
    return response.data;
  } catch (error) {
    throw new Error(getAdminAutomationErrorMessage(error));
  }
};

export const saveAlpacaPaperAutomationSettings = async (
  input: SaveAlpacaPaperAutomationSettingsPayload
) => {
  try {
    const response = await saveAlpacaPaperAutomationSettingsCallable(input);
    return response.data;
  } catch (error) {
    throw new Error(getAdminAutomationErrorMessage(error));
  }
};

export const runAdminPaperExecutionTest = async (
  input: RunAdminPaperExecutionTestPayload = {}
) => {
  try {
    const response = await runAdminPaperExecutionTestCallable(input);
    return response.data;
  } catch (error) {
    throw new Error(getAdminAutomationErrorMessage(error));
  }
};

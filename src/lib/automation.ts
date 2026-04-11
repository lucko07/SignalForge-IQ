import { httpsCallable } from "firebase/functions";
import type { FunctionsError } from "firebase/functions";
import { functions } from "./firebase";

type SaveAutomationSettingsPayload = {
  automationEnabled: boolean;
  destinationUrl: string;
  verificationSecret: string;
  assetFilters: string[];
};

type SaveAutomationSettingsResponse = {
  ok: boolean;
  automationEnabled: boolean;
  hasDestinationUrl: boolean;
  hasVerificationSecret: boolean;
  assetFilterCount: number;
};

const saveAutomationSettingsCallable = httpsCallable<
  SaveAutomationSettingsPayload,
  SaveAutomationSettingsResponse
>(functions, "saveAutomationSettings");

const getAutomationErrorMessage = (error: unknown) => {
  const code = (error as FunctionsError | undefined)?.code;

  switch (code) {
    case "functions/permission-denied":
      return "Your account does not have access to automation settings.";
    case "functions/unauthenticated":
      return "Sign in to manage automation settings.";
    case "functions/invalid-argument":
      return "Review your automation settings and try again.";
    case "functions/resource-exhausted":
      return "Too many attempts. Please wait and try again.";
    default:
      return "Unable to save automation settings right now.";
  }
};

export const saveAutomationSettings = async (input: SaveAutomationSettingsPayload) => {
  try {
    const response = await saveAutomationSettingsCallable(input);
    return response.data;
  } catch (error) {
    throw new Error(getAutomationErrorMessage(error));
  }
};

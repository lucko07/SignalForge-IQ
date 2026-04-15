import type { Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { isAdminProfile } from "../access.js";
import type { AutomationSettings, BrokerConnection } from "./types.js";
import { getAutomationSettings, getBrokerConnection } from "./userState.js";

type AdminPaperExecutionTarget = {
  uid: string;
  settings: AutomationSettings;
  brokerConnection: BrokerConnection;
};

const isEligibleAutomationSettings = (settings: AutomationSettings) => (
  settings.enabled === true
  && settings.provider === "alpaca"
  && settings.mode === "paper"
);

const isEligibleBrokerConnection = (brokerConnection: BrokerConnection) => (
  brokerConnection.provider === "alpaca"
  && brokerConnection.mode === "paper"
  && brokerConnection.connected === true
  && brokerConnection.paperTradingEnabled === true
);

export const resolveAdminPaperExecutionTarget = async (
  db: Firestore
): Promise<AdminPaperExecutionTarget | null> => {
  const roleSnapshot = await db.collection("users").where("role", "==", "admin").limit(10).get();
  const planSnapshot = await db.collection("users").where("plan", "==", "admin").limit(10).get();
  const candidateSnapshots = [...roleSnapshot.docs, ...planSnapshot.docs];
  const candidateIds = [...new Set(candidateSnapshots.map((snapshot) => snapshot.id))];

  logger.info("Resolving admin paper execution target.", {
    candidateCount: candidateIds.length,
  });

  for (const uid of candidateIds) {
    const profile = candidateSnapshots.find((snapshot) => snapshot.id === uid)?.data();

    if (!isAdminProfile(profile)) {
      logger.info("Skipping non-admin execution candidate.", { uid });
      continue;
    }

    const [settings, brokerConnection] = await Promise.all([
      getAutomationSettings(db, uid),
      getBrokerConnection(db, uid),
    ]);

    logger.info("Evaluated admin paper execution candidate.", {
      uid,
      enabled: settings.enabled,
      provider: settings.provider,
      mode: settings.mode,
      brokerConnected: brokerConnection.connected,
      paperTradingEnabled: brokerConnection.paperTradingEnabled,
    });

    if (!isEligibleAutomationSettings(settings)) {
      logger.info("Skipping admin execution candidate with ineligible automation settings.", {
        uid,
        enabled: settings.enabled,
        provider: settings.provider,
        mode: settings.mode,
      });
      continue;
    }

    if (!isEligibleBrokerConnection(brokerConnection)) {
      logger.info("Skipping admin execution candidate with inactive broker connection.", {
        uid,
        connected: brokerConnection.connected,
        paperTradingEnabled: brokerConnection.paperTradingEnabled,
      });
      continue;
    }

    logger.info("Resolved admin paper execution target.", {
      uid,
      symbolAllowlist: settings.symbolAllowlist,
      notionalUsd: settings.notionalUsd,
    });

    return {
      uid,
      settings,
      brokerConnection,
    };
  }

  logger.warn("No eligible admin paper execution target was found.");
  return null;
};

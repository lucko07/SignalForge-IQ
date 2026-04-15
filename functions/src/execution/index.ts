import { logger } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { executeTradeThroughAlpacaPaper } from "./executeTrade.js";
import type { NormalizedTradeRecord } from "./types.js";
import { getFirestore } from "firebase-admin/firestore";
import { resolveAdminPaperExecutionTarget } from "./adminTarget.js";

const alpacaApiKeySecret = defineSecret("ALPACA_API_KEY");
const alpacaSecretKeySecret = defineSecret("ALPACA_SECRET_KEY");

export const executePaperTradeFromTrade = onDocumentCreated(
  {
    document: "trades/{tradeId}",
    secrets: [alpacaApiKeySecret, alpacaSecretKeySecret],
  },
  async (event) => {
    const snapshot = event.data;
    const tradeId = event.params.tradeId;

    if (!snapshot) {
      logger.warn("Alpaca execution trigger fired without trade document data.", { tradeId });
      return;
    }

    const trade = snapshot.data() as NormalizedTradeRecord;

    logger.info("Alpaca paper execution trigger received.", {
      tradeId,
      signalId: trade.signalId ?? null,
      symbol: trade.symbol ?? null,
      side: trade.side ?? null,
    });

    const db = getFirestore();
    const adminTarget = await resolveAdminPaperExecutionTarget(db);

    if (!adminTarget) {
      logger.warn("Alpaca paper execution skipped because no eligible admin automation target is enabled.", {
        tradeId,
        signalId: trade.signalId ?? null,
        symbol: trade.symbol ?? null,
        side: trade.side ?? null,
      });
      return;
    }

    logger.info("Alpaca paper execution target resolved for live trade.", {
      tradeId,
      signalId: trade.signalId ?? null,
      executionUid: adminTarget.uid,
      provider: adminTarget.settings.provider,
      mode: adminTarget.settings.mode,
      notionalUsd: adminTarget.settings.notionalUsd,
    });

    await executeTradeThroughAlpacaPaper({
      db,
      trade: {
        ...trade,
        tradeId,
      },
      automationSettings: adminTarget.settings,
      executionUid: adminTarget.uid,
      accessContext: "automation",
    });
  }
);

import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { google, type sheets_v4 } from "googleapis";

export const GOOGLE_SHEETS_CLIENT_EMAIL = defineSecret("GOOGLE_SHEETS_CLIENT_EMAIL");
export const GOOGLE_SHEETS_PRIVATE_KEY = defineSecret("GOOGLE_SHEETS_PRIVATE_KEY");

const TRADE_HEADERS = [
  "eventId",
  "signalId",
  "tradeId",
  "symbol",
  "side",
  "entryPrice",
  "stopPrice",
  "targetPrice",
  "exitPrice",
  "result",
  "closeReason",
  "rrPlanned",
  "rrActual",
  "pnlPercent",
  "pnlDollar",
  "createdAt",
  "exitTime",
] as const;

type TradeHeader = (typeof TRADE_HEADERS)[number];
type TradeSheetRow = Partial<Record<TradeHeader, unknown>> & { tradeId: string };

const getSheetsClient = async () => {
  const auth = new google.auth.JWT({
    email: GOOGLE_SHEETS_CLIENT_EMAIL.value(),
    key: GOOGLE_SHEETS_PRIVATE_KEY.value().replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  await auth.authorize();

  return google.sheets({ version: "v4", auth });
};

const getTradesSheetValues = async (
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string
) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  });

  return response.data.values ?? [];
};

const normalizeHeaderValue = (value: unknown) => (
  typeof value === "string" ? value.trim() : ""
);

const getColumnLetter = (columnNumber: number) => {
  let current = columnNumber;
  let columnLetter = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    columnLetter = String.fromCharCode(65 + remainder) + columnLetter;
    current = Math.floor((current - 1) / 26);
  }

  return columnLetter;
};

const updateRowValues = async (
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  rowNumber: number,
  values: string[]
) => {
  const endColumn = getColumnLetter(values.length);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${rowNumber}:${endColumn}${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [values],
    },
  });
};

const ensureTradeHeaders = async (
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  rows: string[][]
) => {
  const existingHeaders = (rows[0] ?? []).map(normalizeHeaderValue).filter(Boolean);

  if (existingHeaders.length === 0) {
    await updateRowValues(sheets, spreadsheetId, sheetName, 1, [...TRADE_HEADERS]);
    return [...TRADE_HEADERS];
  }

  const mergedHeaders = [...existingHeaders];

  for (const requiredHeader of TRADE_HEADERS) {
    if (!mergedHeaders.includes(requiredHeader)) {
      mergedHeaders.push(requiredHeader);
    }
  }

  if (mergedHeaders.length !== existingHeaders.length) {
    await updateRowValues(sheets, spreadsheetId, sheetName, 1, mergedHeaders);
  }

  return mergedHeaders;
};

const buildHeaderIndexMap = (headers: string[]) => new Map(
  headers.map((header, index) => [header, index + 1] as const)
);

const findTradeRowByTradeId = (
  rows: string[][],
  tradeIdColumnIndex: number,
  tradeId: string
) => {
  const matchingRowNumbers: number[] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const cellValue = normalizeHeaderValue(row[tradeIdColumnIndex - 1]);

    if (cellValue === tradeId) {
      matchingRowNumbers.push(index + 1);
    }
  }

  return matchingRowNumbers;
};

const toSheetCellValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return "";
};

const buildTradeRow = (trade: TradeSheetRow, headers: string[]) => {
  const normalizedTradeId = trade.tradeId.trim();

  if (!normalizedTradeId) {
    throw new Error("Google Sheets upsert requires a non-empty tradeId.");
  }

  const rowValues: Record<string, string> = {
    eventId: toSheetCellValue(trade.eventId),
    signalId: toSheetCellValue(trade.signalId),
    tradeId: normalizedTradeId,
    symbol: toSheetCellValue(trade.symbol),
    side: toSheetCellValue(trade.side),
    entryPrice: toSheetCellValue(trade.entryPrice),
    stopPrice: toSheetCellValue(trade.stopPrice),
    targetPrice: toSheetCellValue(trade.targetPrice),
    exitPrice: toSheetCellValue(trade.exitPrice),
    result: toSheetCellValue(trade.result),
    closeReason: toSheetCellValue(trade.closeReason),
    rrPlanned: toSheetCellValue(trade.rrPlanned),
    rrActual: toSheetCellValue(trade.rrActual),
    pnlPercent: toSheetCellValue(trade.pnlPercent),
    pnlDollar: toSheetCellValue(trade.pnlDollar),
    createdAt: toSheetCellValue(trade.createdAt),
    exitTime: toSheetCellValue(trade.exitTime),
  };

  return headers.map((header) => rowValues[header] ?? "");
};

const appendTradeRow = async (
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  values: string[]
) => {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [values],
    },
  });
};

const updateTradeRow = async (
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  rowNumber: number,
  values: string[]
) => {
  await updateRowValues(sheets, spreadsheetId, sheetName, rowNumber, values);
};

export async function upsertTradeRow(
  spreadsheetId: string,
  sheetName: string,
  trade: TradeSheetRow
) {
  if (typeof trade.tradeId !== "string" || !trade.tradeId.trim()) {
    throw new Error("Google Sheets upsert requires tradeId.");
  }

  const sheets = await getSheetsClient();
  const rows = await getTradesSheetValues(sheets, spreadsheetId, sheetName);
  const headers = await ensureTradeHeaders(sheets, spreadsheetId, sheetName, rows);
  const headerIndexMap = buildHeaderIndexMap(headers);
  const tradeIdColumnIndex = headerIndexMap.get("tradeId");

  if (!tradeIdColumnIndex) {
    throw new Error('Google Sheets header row is missing required "tradeId" column.');
  }

  const normalizedTradeId = trade.tradeId.trim();
  const matchingRowNumbers = findTradeRowByTradeId(rows, tradeIdColumnIndex, normalizedTradeId);
  const rowValues = buildTradeRow({ ...trade, tradeId: normalizedTradeId }, headers);

  if (matchingRowNumbers.length > 1) {
    logger.warn("Duplicate tradeId rows found in Google Sheets; updating first occurrence only.", {
      tradeId: normalizedTradeId,
      rowNumbers: matchingRowNumbers,
      sheetName,
    });
  }

  if (matchingRowNumbers.length > 0) {
    await updateTradeRow(sheets, spreadsheetId, sheetName, matchingRowNumbers[0], rowValues);
    return;
  }

  await appendTradeRow(sheets, spreadsheetId, sheetName, rowValues);
}

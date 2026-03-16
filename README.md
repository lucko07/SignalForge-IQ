# SignalForge IQ

SignalForge IQ is a React + Vite + TypeScript + Firebase application with public marketing pages, Firebase Authentication, a protected dashboard, and Firestore-backed trading signals.

## Frontend

- Run the app: `npm run dev`
- Production build: `npm run build`

## Signal Ingestion Webhook

The project includes a Firebase Cloud Functions 2nd gen HTTP endpoint for automatic signal ingestion from TradingView alerts, webhook relays, or a future Python strategy engine.

### Endpoint

After deployment, the endpoint will be exposed as:

`https://<region>-<project-id>.cloudfunctions.net/ingestSignal`

If you deploy with the default project in this repo, the project id is `signalforge-iq-3ff7f`.

### Authentication

Every request must include a shared secret.

Supported options:

- Request header: `x-signal-secret: <your-secret>`
- JSON body: `"secret": "<your-secret>"`

The function compares the provided value against the Firebase Functions secret:

`SIGNAL_INGEST_SECRET`

Unauthorized requests return `401`.

### Expected JSON Payload

Required fields:

- `symbol`
- `assetType`
- `direction`
- `entry`
- `stopLoss`
- `target`
- `thesis`
- `status`

Optional fields:

- `source`
- `timeframe`
- `confidence`
- `strategyName`

Example payload:

```json
{
  "symbol": "BTC",
  "assetType": "crypto",
  "direction": "LONG",
  "entry": "42000",
  "stopLoss": "41000",
  "target": "45000",
  "thesis": "Breakout above resistance",
  "status": "ACTIVE",
  "source": "tradingview",
  "timeframe": "4H",
  "confidence": "high",
  "strategyName": "Breakout Engine v1"
}
```

Validation rules:

- all required fields must exist and be non-empty strings
- `direction` must be `LONG` or `SHORT`
- `status` must be `ACTIVE`, `CLOSED`, or `PENDING`

Malformed requests return `400`.

### Firestore Writes

Valid signals are written server-side only using the Firebase Admin SDK.

Default collection behavior:

- `signals` when `AUTO_PUBLISH_SIGNALS = true`
- `pendingSignals` when `AUTO_PUBLISH_SIGNALS = false`

Server-generated fields:

- `createdAt`
- `source` defaults to `"webhook"` if omitted
- `ingestionTimestamp`
- `ingestedBy: "function"`

### Local Function Files

- [`functions/src/index.ts`](./functions/src/index.ts)
- [`functions/src/signalIngestion.ts`](./functions/src/signalIngestion.ts)

### Set the Shared Secret

Install the Firebase CLI if needed, then set the function secret:

```bash
firebase functions:secrets:set SIGNAL_INGEST_SECRET
```

### Deploy Functions

Install dependencies in the functions workspace, then deploy:

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

### Test With curl

```bash
curl -X POST "https://us-central1-signalforge-iq-3ff7f.cloudfunctions.net/ingestSignal" \
  -H "Content-Type: application/json" \
  -H "x-signal-secret: YOUR_SECRET" \
  -d '{
    "symbol": "BTC",
    "assetType": "crypto",
    "direction": "LONG",
    "entry": "42000",
    "stopLoss": "41000",
    "target": "45000",
    "thesis": "Breakout above resistance",
    "status": "ACTIVE"
  }'
```

### Test With PowerShell

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "x-signal-secret" = "YOUR_SECRET"
}

$body = @{
  symbol = "BTC"
  assetType = "crypto"
  direction = "LONG"
  entry = "42000"
  stopLoss = "41000"
  target = "45000"
  thesis = "Breakout above resistance"
  status = "ACTIVE"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "https://us-central1-signalforge-iq-3ff7f.cloudfunctions.net/ingestSignal" `
  -Headers $headers `
  -Body $body
```

## Notes

- The ingestion flow does not expose admin credentials in frontend code.
- The public frontend does not write webhook signals directly to Firestore.
- Existing auth, routes, and dashboard signal loading remain separate from the webhook ingestion flow.

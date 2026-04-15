# User Broker Onboarding Architecture

This note captures the next-stage paper-safe architecture for future user-facing Alpaca onboarding.

## Firestore model

Document path:
`users/{uid}/brokerConnections/alpaca`

Current paper-safe shape:

```ts
{
  provider: "alpaca",
  mode: "paper",
  connected: boolean,
  lastValidatedAt: Timestamp | null,
  paperTradingEnabled: boolean,
  createdAt: Timestamp | null,
  updatedAt: Timestamp | null,
}
```

## Safety boundaries

- `mode` remains `paper` only.
- No live trading path is exposed.
- No client-side broker secret storage is introduced.
- Connection validation and broker state changes stay server-side.
- Firestore remains the source of truth for broker connection state.

## Future rollout direction

- Add a server-mediated onboarding flow for Alpaca OAuth or secure token exchange.
- Persist only connection state and safe metadata in Firestore.
- Keep actual secrets in server-managed infrastructure, never in browser-accessible documents.
- Gate user-facing broker automation behind backend eligibility and subscription policy.

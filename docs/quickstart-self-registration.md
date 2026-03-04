# Quickstart: Self-Registration (Agent-First)

Create an agent wallet instantly — no master key, no browser login upfront. The agent starts working immediately and the user claims ownership later.

This is the flow used by the Claude skill and CLI for self-serve onboarding.

## How it works

```
Your Code                              User (later)
   │                                      │
   ├── POST /api/agents/register ──→ Agent + API key + claim code
   │   (no auth needed)                    │
   │                                       │
   ├── Agent works immediately             │
   │   (balances, transfers, x402)         │
   │                                       │
   └── Send claim URL to user ────────→  Opens link, logs in
                                           │
                                        Ownership transfers
                                        (optional: tweet for $1 USDC)
```

1. Call `POST /api/agents/register` with `agentFirst: true` — returns an API key and claim code instantly
2. Agent is live. It can check balances, transfer, swap, make x402 payments
3. The agent is owned by a temporary anonymous account until claimed
4. Send the claim URL to the user. They log in via browser and ownership transfers to their real account
5. If `claimRequired: true`, they can tweet to receive a $1 USDC bonus

## Prerequisites

- Node.js 18+ or Bun
- No API keys needed — the register endpoint is unauthenticated

## Install

```bash
npm install @paysponge/sdk
```

## 1. Register an agent

```typescript
const API_BASE = "https://api.wallet.paysponge.com";

const response = await fetch(`${API_BASE}/api/agents/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "my-agent",
    agentFirst: true,       // Create agent + key immediately
    testnet: true,          // Use testnets
    claimRequired: true,    // Enable tweet-to-claim for $1 USDC
    email: "alice@example.com", // Optional: restricts who can claim
  }),
});

const registration = await response.json();
```

The response includes everything you need:

```typescript
{
  agentId: "uuid-...",           // Agent ID
  apiKey: "sponge_test_...",     // Works immediately
  userCode: "ABCD-1234",        // Human-readable claim code
  claimCode: "ABCD-1234",       // Same as userCode
  verificationUriComplete: "https://wallet.paysponge.com/device?code=ABCD-1234",
  claimText: "I just claimed a wallet for my agent...",  // Tweet template
  expiresIn: 315360000,         // ~10 years
}
```

## 2. Connect and start working

The API key works immediately — no need to wait for the claim.

```typescript
import { SpongeWallet } from "@paysponge/sdk";

const wallet = await SpongeWallet.connect({
  apiKey: registration.apiKey,
  agentId: registration.agentId,
});

// Agent is live
const addresses = await wallet.getAddresses();
console.log("Base:", addresses.base);
console.log("Solana:", addresses.solana);
```

## 3. Fetch balances

```typescript
const balances = await wallet.getDetailedBalances();

for (const [chain, info] of Object.entries(balances)) {
  for (const token of info.balances) {
    console.log(`${chain}: ${token.amount} ${token.token}`);
  }
}
```

## 4. Make x402 payments

```typescript
// Automatic: handles 402 response, creates payment, retries
const result = await wallet.x402Fetch({
  url: "https://api.example.com/premium-endpoint",
  method: "GET",
  preferredChain: "base",
});

// Manual: create payment payload yourself
const payment = await wallet.createX402Payment({
  chain: "base",
  to: "0x...",
  amount: "0.01",
  resource_url: "https://api.example.com/premium-endpoint",
  http_method: "GET",
});
```

## 5. User claims the wallet

Send the claim URL to the user. They can claim anytime — the agent keeps working in the meantime.

```
Claim URL: https://wallet.paysponge.com/device?code=ABCD-1234
```

When the user opens the link:
1. They log in (or create an account) via the Sponge dashboard
2. If `email` was set during registration, their email must match
3. Ownership transfers from the anonymous placeholder to their real account
4. If `claimRequired` was set and they tweet the claim text, they get $1 USDC

## Email lock

If you pass `email` during registration, only that email can claim the agent:

```typescript
// Only alice@example.com can claim this agent
body: JSON.stringify({
  name: "alice-agent",
  agentFirst: true,
  email: "alice@example.com",
})
```

If someone with a different email tries to claim, they get a 403 error.

## Runnable example

See [`examples/per-user-agents.ts`](../examples/per-user-agents.ts) for the complete flow.

```bash
USER_EMAIL=alice@example.com bun run examples/per-user-agents.ts

# With x402 payment:
USER_EMAIL=alice@example.com X402_URL=https://paid.example.com/api bun run examples/per-user-agents.ts
```

## Next steps

- [Wallets & Transfers](./wallets-and-transfers.md) — Transfer tokens, swap, check history
- [Claude Integration](./claude-integration.md) — Give Claude wallet tools via MCP
- [API Reference](./api-reference.md) — Every method and type

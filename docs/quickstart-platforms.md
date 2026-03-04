# Quickstart: Platforms

Build a product that creates and manages agent wallets programmatically — a bot fleet, a marketplace, a SaaS with embedded wallets.

## Prerequisites

- Node.js 18+ or Bun
- A **master API key** (`sponge_master_...`) — contact the team to get one

## How it works

```
Your Platform
    │
    ├── Master key ─── POST /api/agents/ ──→ Agent + agent API key
    │                                              │
    │                                    SpongeWallet.connect({ apiKey })
    │                                              │
    └── Agent operates its own wallet ◄────────────┘
```

1. You use your master key to create agents via REST
2. Each agent gets its own scoped API key
3. You pass that key to `SpongeWallet.connect()` — no browser auth needed

## 1. Create an agent

```typescript
const MASTER_KEY = process.env.SPONGE_MASTER_KEY;
const API_BASE = "https://api.wallet.paysponge.com";

async function createAgent(name: string) {
  const response = await fetch(`${API_BASE}/api/agents/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MASTER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      description: "Created by platform",
    }),
  });

  const { agent, apiKey } = await response.json();
  return { agent, apiKey };
}

const { agent, apiKey } = await createAgent("trading-bot-1");
console.log(agent.id);  // uuid
console.log(apiKey);     // sponge_test_...
```

Store the returned `apiKey` — it's the only way to authenticate as this agent.

## 2. Connect to an agent's wallet

```typescript
import { SpongeWallet } from "@paysponge/sdk";

const wallet = await SpongeWallet.connect({ apiKey });

const addresses = await wallet.getAddresses();
console.log("EVM:", addresses.base);     // 0x...
console.log("Solana:", addresses.solana); // 5x...
```

Each agent automatically gets wallets on all supported chains. The same EVM address works across Ethereum, Base, and testnets. Same for Solana.

## 3. Manage a fleet

```typescript
// List all agents
const listResponse = await fetch(`${API_BASE}/api/agents/`, {
  headers: { Authorization: `Bearer ${MASTER_KEY}` },
});
const agents = await listResponse.json();

// Update an agent
await fetch(`${API_BASE}/api/agents/${agent.id}`, {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${MASTER_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    description: "Updated description",
  }),
});

// Delete an agent
await fetch(`${API_BASE}/api/agents/${agent.id}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${MASTER_KEY}` },
});
```

## 4. Set spending limits

Spending limits are set per agent and enforced server-side on every transfer:

```typescript
await fetch(`${API_BASE}/api/agents/${agent.id}`, {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${MASTER_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    dailySpendingLimit: "100",   // $100/day
    weeklySpendingLimit: "500",  // $500/week
    monthlySpendingLimit: "1500", // $1500/month
  }),
});
```

Transfers that exceed limits return a `SpongeApiError` with the relevant error code.

## 5. Give agents to Claude

Once you have an agent API key, you can hand it to Claude:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { SpongeWallet } from "@paysponge/sdk";

// Each agent gets its own wallet
const wallet = await SpongeWallet.connect({ apiKey: agentApiKey });

for await (const msg of query({
  prompt: "You are a trading assistant. Check your balances.",
  options: {
    mcpServers: {
      wallet: wallet.mcp(),
    },
  },
})) {
  console.log(msg);
}
```

## Key types

| Prefix | Scope | Use |
|--------|-------|-----|
| `sponge_master_` | Your account | Create/list/delete agents |
| `sponge_test_` | One agent | Full wallet access (testnet) |
| `sponge_live_` | One agent | Full wallet access (mainnet) |

Master keys never touch wallets directly. Agent keys never create other agents.

## Complete example: bot fleet

```typescript
import { SpongeWallet } from "@paysponge/sdk";

const MASTER_KEY = process.env.SPONGE_MASTER_KEY!;
const API_BASE = "https://api.wallet.paysponge.com";

async function spawnBot(name: string): Promise<SpongeWallet> {
  const res = await fetch(`${API_BASE}/api/agents/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MASTER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  const { apiKey } = await res.json();
  return SpongeWallet.connect({ apiKey });
}

async function main() {
  // Spin up 3 bots
  const bots = await Promise.all([
    spawnBot("arb-bot-eth"),
    spawnBot("arb-bot-sol"),
    spawnBot("arb-bot-base"),
  ]);

  // Each has its own addresses and balances
  for (const bot of bots) {
    const addresses = await bot.getAddresses();
    const balances = await bot.getBalances();
    console.log(addresses, balances);
  }
}

main();
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `SPONGE_MASTER_KEY` | Master key for creating agents |
| `SPONGE_API_URL` | Custom API URL (default: `https://api.wallet.paysponge.com`) |

## Alternative: agent-first self-registration

If you don't want to manage master keys, use the agent-first registration flow instead. This creates agents via `POST /api/agents/register` — no auth required. The user claims their wallet later via a link.

See [`examples/per-user-agents.ts`](../examples/per-user-agents.ts) for a complete example, or the [Self-Registration guide](./quickstart-self-registration.md) for details.

## Next steps

- [Master Keys](./master-keys.md) — Full REST API reference for agent management
- [Authentication](./authentication.md) — All auth methods explained
- [API Reference](./api-reference.md) — Every SDK method and type

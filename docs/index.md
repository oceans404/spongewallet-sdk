# SpongeWallet SDK — Early Access

Give your AI agents their own crypto wallets. Transfer, swap, bridge, and trade across EVM and Solana — from a single TypeScript SDK.

> **Early access.** Things may change. If something breaks, reach out — we want to hear from you.

## Install

```bash
npm install @paysponge/sdk
```

## Pick your path

### I'm building an AI agent

You're using the Claude Agent SDK, Anthropic SDK, or another LLM framework and want your agent to hold and move money.

**Start here →** [Quickstart: AI Agents](./quickstart-ai-agents.md)

What you'll do:
- Connect a wallet in 3 lines of code
- Give Claude wallet tools via MCP or direct tool definitions
- Let your agent check balances, transfer tokens, and swap

---

### I just want a wallet for my agent (self-serve)

You want to create an agent wallet instantly — no master key, no admin setup. The agent works immediately and you claim ownership later via a link.

**Start here →** [Quickstart: Self-Registration](./quickstart-self-registration.md)

What you'll do:
- Register an agent with one API call (no auth required)
- Agent starts working immediately (balances, transfers, x402 payments)
- Claim the wallet later via browser link
- Optionally tweet to get $1 USDC bonus

---

### I'm building a platform

You're building a product that spins up wallets for agents or users programmatically — a bot fleet, a marketplace, a SaaS with embedded wallets.

**Start here →** [Quickstart: Platforms](./quickstart-platforms.md)

What you'll do:
- Create agents with master API keys (no browser auth)
- Manage spending limits and allowlists
- Orchestrate multiple agent wallets from your backend

---

### I'm building a trading bot

You want an AI agent that trades — swaps on Jupiter or 0x, perps on Hyperliquid, cross-chain bridges, or automated DeFi strategies.

**Start here →** [Quickstart: Trading & DeFi](./quickstart-trading.md)

What you'll do:
- Swap tokens on Solana (Jupiter) and Base (0x)
- Trade perpetuals on Hyperliquid
- Bridge assets cross-chain
- Make HTTP payments with x402

---

## Reference docs

Once you're past the quickstart, these cover everything:

- [Self-Registration](./quickstart-self-registration.md) — Agent-first signup, claim flow, x402 payments
- [Authentication](./authentication.md) — Device flow, API keys, master keys, credential storage
- [Wallets & Transfers](./wallets-and-transfers.md) — Chains, addresses, balances, transfers, swaps
- [Claude Integration](./claude-integration.md) — MCP config, direct tools, agentic loops
- [API Reference](./api-reference.md) — Every method, type, and option
- [Master Keys](./master-keys.md) — Programmatic agent creation via REST

## Supported chains

| Chain | Type | Network | Chain ID |
|-------|------|---------|----------|
| `ethereum` | EVM | Mainnet | 1 |
| `base` | EVM | Mainnet | 8453 |
| `sepolia` | EVM | Testnet | 11155111 |
| `base-sepolia` | EVM | Testnet | 84532 |
| `tempo` | EVM | Testnet | 42431 |
| `solana` | Solana | Mainnet | 101 |
| `solana-devnet` | Solana | Testnet | 102 |

## Getting help

This is early access software. If you hit a wall, open an issue or reach out directly — we're actively building alongside early users.

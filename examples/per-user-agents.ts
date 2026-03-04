/**
 * Agent-First Registration (Self-Signup + Claim)
 *
 * The self-registration flow for giving each user their own agent wallet:
 *
 * 1. Call POST /api/agents/register with agentFirst: true
 *    → Agent + API key are created immediately (no browser, no master key)
 * 2. Agent can start working right away with the returned API key
 * 3. User receives a claim URL and claims the wallet later via browser
 *    → Ownership transfers from anonymous placeholder to real account
 *    → Optionally tweet to get $1 USDC bonus
 *
 * This is the pattern used by the Claude skill / CLI for self-serve onboarding.
 * No master key required.
 *
 * Run with:
 *   cd packages/spongewallet-sdk
 *   USER_EMAIL=alice@example.com bun run examples/per-user-agents.ts
 *
 * Optional:
 *   SPONGE_API_URL=http://localhost:8000
 *   X402_URL=https://paid.example.com/api/data
 */

import { SpongeWallet } from "../src/index.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE = process.env.SPONGE_API_URL ?? "https://api.wallet.paysponge.com";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RegisterResponse = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  claimCode: string;
  claimText: string | null;
  agentId: string;
  apiKey: string;
  expiresIn: number;
};

// ---------------------------------------------------------------------------
// Agent-first registration
// ---------------------------------------------------------------------------

/**
 * Register a new agent via the self-signup endpoint.
 * No master key needed — creates an anonymous user + agent immediately.
 * The returned API key works right away; the human claims later.
 */
async function registerAgent(opts: {
  name: string;
  email?: string;
  testnet?: boolean;
}): Promise<RegisterResponse> {
  const response = await fetch(`${API_BASE}/api/agents/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: opts.name,
      agentFirst: true,
      testnet: opts.testnet ?? false,
      claimRequired: true,
      email: opts.email,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Registration failed (${response.status}): ${body}`);
  }

  return (await response.json()) as RegisterResponse;
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

async function main() {
  const email = process.env.USER_EMAIL;
  if (!email) {
    console.error("Usage: USER_EMAIL=alice@example.com bun run examples/per-user-agents.ts");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("Agent-First Registration");
  console.log("=".repeat(60));
  console.log();

  // ── Step 1: Register agent (no master key, no browser) ─────
  const agentName = `agent-${email.split("@")[0]?.replace(/[^a-z0-9_-]/gi, "-") ?? "user"}`;

  console.log(`1. Registering agent "${agentName}" for ${email}...`);
  const registration = await registerAgent({
    name: agentName,
    email,
    testnet: true,
  });

  console.log(`   Agent ID:  ${registration.agentId}`);
  console.log(`   API Key:   ${registration.apiKey.substring(0, 24)}...`);
  console.log();
  console.log(`   Claim URL: ${registration.verificationUriComplete}`);
  console.log(`   Claim code: ${registration.claimCode}`);
  if (registration.claimText) {
    console.log();
    console.log(`   Tweet this to claim $1 USDC:`);
    console.log(`   "${registration.claimText}"`);
  }
  console.log();

  // ── Step 2: Connect wallet (works immediately, before claim) ─
  console.log("2. Connecting wallet (agent is live before claim)...");
  const wallet = await SpongeWallet.connect({
    apiKey: registration.apiKey,
    agentId: registration.agentId,
    baseUrl: API_BASE,
  });
  console.log(`   Connected as agent ${wallet.getAgentId()}`);
  console.log();

  // ── Step 3: Show addresses ─────────────────────────────────
  console.log("3. Wallet addresses:");
  const addresses = await wallet.getAddresses();
  for (const [chain, address] of Object.entries(addresses)) {
    console.log(`   ${chain.padEnd(15)} ${address}`);
  }
  console.log();

  // ── Step 4: Fetch balances ─────────────────────────────────
  console.log("4. Balances:");
  const detailed = await wallet.getDetailedBalances();
  for (const [chain, info] of Object.entries(detailed)) {
    const chainInfo = info as {
      address: string;
      balances: Array<{ token: string; amount: string; usdValue?: string }>;
    };
    if (chainInfo.balances.length === 0) {
      console.log(`   ${chain.padEnd(15)} (empty)`);
      continue;
    }
    for (const b of chainInfo.balances) {
      const usd = b.usdValue ? ` ($${b.usdValue})` : "";
      console.log(`   ${chain.padEnd(15)} ${b.amount} ${b.token}${usd}`);
    }
  }
  console.log();

  // ── Step 5: x402 payment ──────────────────────────────────
  const x402Url = process.env.X402_URL;
  if (x402Url) {
    console.log("5. Making x402 payment...");
    console.log(`   URL: ${x402Url}`);
    try {
      const result = await wallet.x402Fetch({
        url: x402Url,
        method: "GET",
        preferredChain: "base",
      });
      console.log("   Response:", JSON.stringify(result, null, 2));
    } catch (error) {
      console.log(`   Error: ${error instanceof Error ? error.message : error}`);
    }
  } else {
    console.log("5. Skipping x402 payment (set X402_URL to enable)");
  }

  console.log();
  console.log("=".repeat(60));
  console.log("Agent is live and operational.");
  console.log(`Send the claim URL to the user: ${registration.verificationUriComplete}`);
  console.log("They can claim it anytime — the agent keeps working in the meantime.");
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("Failed:", error);
  process.exit(1);
});

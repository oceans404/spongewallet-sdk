# Stellar API Integration

This document outlines the backend and SDK work required to add Stellar network support to SpongeWallet, modeled after the existing Solana integration as the reference non-EVM chain.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Chain Registration](#chain-registration)
- [Wallet Generation](#wallet-generation)
- [Backend Endpoints](#backend-endpoints)
  - [Transfer Endpoint](#transfer-endpoint)
  - [Token Listing Endpoints](#token-listing-endpoints)
  - [Trustline Endpoint](#trustline-endpoint)
  - [Swap Endpoint](#swap-endpoint)
  - [Balance Endpoint](#balance-endpoint)
  - [Transaction Status](#transaction-status)
  - [Transaction History](#transaction-history)
  - [Bridge Support](#bridge-support)
  - [Key Export](#key-export)
  - [Faucet](#faucet)
  - [RPC Proxy](#rpc-proxy)
- [SDK Changes](#sdk-changes)
  - [Type Definitions](#type-definitions)
  - [Tool Definitions](#tool-definitions)
  - [Tool Executor](#tool-executor)
  - [API Layer](#api-layer)
  - [Client Methods](#client-methods)
- [Stellar-Specific Considerations](#stellar-specific-considerations)
  - [Trustlines](#trustlines)
  - [Account Activation](#account-activation)
  - [Asset Model](#asset-model)
- [Implementation Status](#implementation-status)
  - [OpenAPI Spec Update](#openapi-spec-update)
- [Endpoint Comparison: Solana vs Stellar](#endpoint-comparison-solana-vs-stellar)

---

## Architecture Overview

SpongeWallet is a thin SDK client — all key management, transaction building, signing, and chain interaction happens on the backend (`https://api.wallet.paysponge.com`). The SDK handles types, validation, Claude tool definitions, and HTTP routing.

Adding Stellar follows the same pattern established by Solana:
1. Register the chain in the backend chain registry
2. Add backend endpoints for Stellar-specific operations
3. Add SDK types, tool schemas, and routing logic

No Stellar libraries are needed in the SDK itself (just as no `@solana/web3.js` exists in the SDK today). The backend will use the `stellar-sdk` package.

---

## Chain Registration

The backend has a chain registry exposed via:
- `GET /api/chains/` — list all chains
- `GET /api/chains/mainnets` / `GET /api/chains/testnets`
- `GET /api/chains/{chainId}` — get chain config by ID

### New Chain IDs

Following the existing convention (EVM chains use real chain IDs; Solana uses 101/102):

| Chain            | Chain ID | Type     |
|------------------|----------|----------|
| `stellar`        | 103      | mainnet  |
| `stellar-testnet`| 104      | testnet  |

These IDs are arbitrary (Stellar doesn't have a numeric chain ID concept) — they just need to be unique within the Sponge system, consistent with the Solana precedent.

---

## Wallet Generation

`POST /api/wallets/` takes `{ agentId, chainId }`. The backend branches on `chainId` to decide which key type to generate:

| Chain Type | Key Algorithm | Address Format |
|------------|---------------|----------------|
| EVM        | secp256k1     | `0x` + 40 hex chars |
| Solana     | Ed25519       | Base58 (32-44 chars) |
| **Stellar**| **Ed25519**   | **`G` + 55 chars (StrKey public)** |

Stellar and Solana both use Ed25519, but address encoding is completely different:
- **Solana**: Raw public key bytes → Base58
- **Stellar**: Version byte (`0x30`) + public key bytes + CRC16 checksum → Base32 (StrKey)

The backend could potentially derive both addresses from the same Ed25519 key material, but this is a design decision with security implications. A dedicated keypair per chain is the safer default.

### Address Validation Regex

```
Stellar public key: /^G[A-Z2-7]{55}$/
Stellar secret key: /^S[A-Z2-7]{55}$/
```

---

## Backend Endpoints

Every endpoint below is **new backend work** — none of these exist yet. The SDK already routes to them (via `this.http.post`/`this.http.get`) and validates responses with Zod schemas, so the backend must return the exact response shapes documented here.

### Transfer Endpoint

**`POST /api/transfers/stellar`**

```jsonc
// Request
{
  "chain": "stellar" | "stellar-testnet",  // required
  "to": "GABC...XYZ",                      // required, G-address
  "amount": "10.5",                         // required, human-readable
  "currency": "XLM" | "USDC"               // required
}

// Response (must match SDK's SubmitTransactionSchema)
{
  "transactionHash": "a]1b2c3d4e5f...",    // 64 hex chars
  "status": "pending" | "submitted" | "confirmed",
  "explorerUrl": "https://stellar.expert/explorer/public/tx/{hash}",  // optional
  "message": "Transfer successful"          // optional
}
```

**Backend implementation:**
1. Connect to Horizon API (`https://horizon.stellar.org` or `https://horizon-testnet.stellar.org`)
2. Load the source account (to get current sequence number)
3. Check if the destination account exists via Horizon `GET /accounts/{address}`
   - If not and currency is `XLM`: use `CreateAccount` operation (see [Account Activation](#account-activation))
   - If not and currency is non-XLM: fail with `400`: "Destination account does not exist. Fund it with at least 1 XLM first."
4. For non-XLM transfers (e.g., USDC):
   - Check if the **destination** has a trustline for the asset
   - If the destination is the agent's own wallet and trustline is missing: bundle a `ChangeTrust` operation in the same transaction envelope before the `Payment` operation (auto-trustline — see [Trustlines](#trustlines))
   - If the destination is an external address without a trustline: fail with `400`: "Destination does not have a trustline for {currency}. The recipient must add one first."
5. Build a `Payment` or `CreateAccount` operation
6. Sign with the stored Ed25519 secret key
7. Submit to the network via Horizon
8. Return the response object above

**Explorer URL format:** `https://stellar.expert/explorer/public/tx/{hash}` (mainnet) or `https://stellar.expert/explorer/testnet/tx/{hash}` (testnet)

**Error cases:**
- Destination doesn't exist + non-XLM currency → `400`
- Destination missing trustline for asset → `400`
- Amount below minimum reserve for `CreateAccount` (currently 1 XLM) → `400`
- Insufficient source balance → `400`
- Invalid destination address → `400` (SDK also validates client-side)

### Token Listing Endpoints

Stellar needs dedicated token endpoints because its asset model (`code:issuer` pairs + trustlines) differs from both EVM (ERC-20 contracts) and Solana (SPL mints).

#### `GET /api/stellar/tokens?chain={chain}`

Returns all assets held by the agent's Stellar wallet.

```jsonc
// Response (must match SDK's StellarTokensResponseSchema)
{
  "address": "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  "tokens": [
    {
      "assetCode": "XLM",
      "assetIssuer": null,              // null for native XLM
      "symbol": "XLM",
      "name": "Stellar Lumens",
      "balance": "100.0000000",         // 7 decimal places (Stellar standard)
      "decimals": 7,
      "logoURI": "https://..." | null
    },
    {
      "assetCode": "USDC",
      "assetIssuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      "symbol": "USDC",
      "name": "USD Coin",
      "balance": "50.0000000",
      "decimals": 7,
      "logoURI": "https://..." | null
    }
  ]
}
```

**Backend implementation:**
1. Call Horizon `GET /accounts/{accountId}`
2. Parse the `balances` array — each entry has `asset_type`, `asset_code`, `asset_issuer`, `balance`
3. For native XLM: `asset_type` is `"native"`, set `assetIssuer` to `null`
4. Enrich with metadata (symbol, name, logoURI) from a token directory or hardcoded list for well-known assets
5. If account doesn't exist on-chain: return `{ address, tokens: [] }` (not an error)

#### `GET /api/stellar/tokens/search?query={query}&limit={limit}`

Search for known Stellar assets by name or code.

```jsonc
// Response (must match SDK's StellarTokenSearchResponseSchema)
{
  "tokens": [
    {
      "assetCode": "USDC",
      "assetIssuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 7,
      "logoURI": "https://..." | null
    }
  ]
}
```

**Backend implementation:**
- Query a token directory (StellarExpert Asset List via `stellar.expert/api`, or the [Stellar Asset List](https://github.com/AquaToken/stellar-asset-lists) standard)
- Filter by `query` against asset code, name, and domain
- Limit results to `limit` (default 10, max 20)
- Return asset metadata — no balances (this is a global search, not wallet-specific)

### Trustline Endpoint

**`POST /api/stellar/trustline`**

Adds a trustline so the agent's Stellar wallet can hold a non-XLM asset. See [Trustlines](#trustlines) for the full design (explicit tool + auto-trustline during transfers).

```jsonc
// Request
{
  "chain": "stellar" | "stellar-testnet",   // required
  "assetCode": "USDC",                      // required, 1-12 characters
  "assetIssuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"  // required, G-address
}

// Response (must match SDK's StellarTrustlineResponseSchema)
{
  "transactionHash": "abc123...",
  "status": "confirmed",
  "assetCode": "USDC",
  "assetIssuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  "explorerUrl": "https://stellar.expert/explorer/public/tx/abc123..."  // optional
}
```

**Backend implementation:**
1. Load the agent's Stellar account via Horizon `GET /accounts/{accountId}`
2. Check if trustline already exists in the `balances` array — if so, return success immediately (idempotent, no transaction needed, return empty `transactionHash: ""` and `status: "confirmed"`)
3. Build a `ChangeTrust` operation: `new Operation.changeTrust({ asset: new Asset(assetCode, assetIssuer) })`
4. Sign with the agent's stored Ed25519 secret key
5. Submit to Horizon and return the transaction hash

**Error cases:**
- Account not funded → `400`: "Account must be funded with at least 1 XLM before adding trustlines"
- Insufficient XLM for 0.5 XLM base reserve → `400`: "Need at least 0.5 XLM available to add a trustline"
- Invalid asset code (empty or >12 chars) → `400`: validation error (SDK also validates client-side)
- Invalid issuer address → `400`: validation error

### Swap Endpoint

**`POST /api/transactions/swap`** (existing endpoint — add Stellar routing based on `chain` field)

The backend already routes to Jupiter for Solana chains. For `chain: "stellar"` or `chain: "stellar-testnet"`, route to Stellar DEX.

```jsonc
// Request (same shape as Solana swap)
{
  "chain": "stellar" | "stellar-testnet",   // required — this is how backend discriminates
  "inputToken": "XLM",                      // symbol or "code:issuer" for arbitrary assets
  "outputToken": "USDC",                    // symbol or "code:issuer"
  "amount": "100",                          // amount of inputToken
  "slippageBps": 50                         // optional, basis points (default 50 = 0.5%)
}

// Response (must match SDK's SwapResponseSchema used in transactions.ts)
{
  "signature": "a1b2c3d4e5f...",            // transaction hash
  "inputToken": "XLM",
  "outputToken": "USDC",
  "inputAmount": "100.0000000",
  "outputAmount": "12.5000000",
  "explorerUrl": "https://stellar.expert/explorer/public/tx/{hash}"  // optional
}
```

**Backend implementation:**
1. Resolve token symbols to `code:issuer` pairs (e.g., `XLM` → native, `USDC` → `USDC:GA5ZSEJYB...`)
2. If the output asset requires a trustline the agent doesn't have: auto-add it (bundle `ChangeTrust` in the same transaction)
3. Find the best path:
   - Call Horizon `GET /paths/strict-send?source_asset_type=native&source_amount=100&destination_assets=USDC:GA5ZSEJYB...`
   - Or `GET /paths/strict-receive` for exact output amounts
4. Build a `PathPaymentStrictSend` or `PathPaymentStrictReceive` operation with the returned path
5. Apply slippage: set `destMin` (strict-send) or `sendMax` (strict-receive) using `slippageBps`
6. Sign and submit to Horizon
7. Return the response object above

**Quote-then-execute flow** (also needs Stellar support):
- `POST /api/transactions/swap/quote` → call Horizon path finding, cache the result, return quote with `quoteId`
- `POST /api/transactions/swap/execute` → build and submit the path payment using cached quote

**Stellar DEX options (in priority order):**
1. **Path Payments (SDEX)** — Stellar's built-in orderbook DEX. Best for well-known assets with liquidity (XLM, USDC, EURC). Use Horizon path-finding endpoints.
2. **Soroban AMMs** — SoroSwap, Phoenix, or other Soroban-based DEXs. Better for Soroban tokens without SDEX liquidity. Requires Soroban RPC calls.

### Balance Endpoint

**`GET /api/balances?chain=stellar`** (existing generic endpoint — add Stellar branch)

```jsonc
// Response (must match SDK's DetailedBalancesSchema — record keyed by chain name)
{
  "stellar": {
    "address": "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    "balances": [
      { "token": "XLM", "amount": "100.0000000", "usdValue": "10.50" },
      { "token": "USDC", "amount": "50.0000000", "usdValue": "50.00" }
    ]
  }
}
```

**Backend implementation:**
1. Call Horizon `GET /accounts/{accountId}`
2. Parse `balances` array — only assets with active trustlines appear (this is how Horizon works)
3. For native XLM: `asset_type` is `"native"`
4. Convert to `{ token, amount, usdValue }` format — `usdValue` is optional, requires a price feed
5. If account doesn't exist on-chain: return `{ stellar: { address, balances: [] } }` (not an error)

### Transaction Status

**`GET /api/transactions/status/{txHash}?chain=stellar`** (existing generic endpoint — add Stellar branch)

```jsonc
// Response (must match SDK's TransactionStatusResponseSchema)
{
  "transactionHash": "a1b2c3d4e5f...",
  "status": "pending" | "confirmed" | "failed",
  "confirmations": null,                    // Stellar has no confirmations concept — always null
  "blockNumber": 52345678,                  // Stellar ledger sequence number, or null
  "gasUsed": null,                          // N/A for Stellar
  "effectiveGasPrice": null                 // N/A for Stellar
}
```

**Backend implementation:**
1. Query Horizon `GET /transactions/{hash}`
2. Map Stellar's `successful: true` → `"confirmed"`, `successful: false` → `"failed"`
3. If transaction not found: return `status: "pending"` (may still be processing) or `"failed"` if enough time has passed
4. Set `blockNumber` to `ledger` (Stellar's ledger sequence number)
5. `confirmations`, `gasUsed`, `effectiveGasPrice` are always `null` (Stellar doesn't have these concepts — fees are flat, finality is ~5 seconds)

Note: Stellar transaction hashes are 64 hex chars (same as EVM), so the `chain` query parameter is required for the backend to know which chain to query.

### Transaction History

**`GET /api/transactions/history?chain=stellar`** (existing generic endpoint — add Stellar branch)

```jsonc
// Response (must match SDK's TransactionHistoryDetailedSchema)
{
  "transactions": [
    {
      "txHash": "a1b2c3d4e5f...",        // 64 hex chars, or null if pending
      "status": "confirmed",
      "from": "GAAZI4TCR3TY5...",         // source G-address
      "to": "GBXYZ...",                   // destination G-address
      "value": "10.0000000",
      "token": "XLM",                     // asset code
      "direction": "outgoing" | "incoming",
      "chain": "stellar",
      "timestamp": "2026-03-10T12:00:00Z" // ISO 8601
    }
  ],
  "total": 42,
  "hasMore": true
}
```

**Backend implementation:**
1. Query Horizon `GET /accounts/{accountId}/operations?order=desc&limit={limit}`
2. Filter to payment-related operations: `payment`, `path_payment_strict_send`, `path_payment_strict_receive`, `create_account`
3. For each operation:
   - `from`: source account
   - `to`: destination account (or the created account for `create_account`)
   - `value`: amount
   - `token`: `asset_code` (or `"XLM"` for native)
   - `direction`: compare source to agent's address
   - `timestamp`: from the parent transaction's `created_at`
4. Pagination: use Horizon's cursor-based pagination, translate to `total`/`hasMore`

### Bridge Support

**`POST /api/transactions/bridge`** (existing endpoint — extend chain enums)

1. Add `"stellar"` and `"stellar-testnet"` to both `sourceChain` and `destinationChain` enums
2. Integrate a bridge provider that supports Stellar:
   - **Allbridge** — supports Stellar <-> EVM/Solana
   - **Circle CCTP** — if/when extended to Stellar for native USDC bridging
3. No new response schema needed — reuse the existing bridge response format

### Key Export

**`POST /api/wallets/{id}/export-key`** (existing endpoint — add Stellar format)

Already supports exporting private keys with signature verification or email OTP. For Stellar wallets:
- Export the Ed25519 secret key in Stellar's `S...` StrKey format (not raw bytes)
- The StrKey secret format is: version byte `0x90` + raw 32-byte secret + CRC16 checksum → Base32

### Faucet

**`POST /api/faucet/request`** (existing endpoint — add Stellar testnet branch)

Takes `{ chainId, address }`. For `chainId: 104` (stellar-testnet):
- Call [Stellar Friendbot](https://friendbot.stellar.org/?addr={address}) to fund the account with 10,000 testnet XLM
- This also activates the account on-chain (creates it) if it doesn't exist
- Return success/failure — the Friendbot response includes the funding transaction hash

### RPC Proxy

**`POST /api/rpc/{chainId}`** (existing endpoint — add Stellar routing)

For `chainId: 103` or `104`, proxy to:
- **Horizon API** (`horizon.stellar.org` / `horizon-testnet.stellar.org`) for standard queries (accounts, transactions, operations, orderbook, paths)
- **Soroban RPC** (`soroban-rpc.mainnet.stellar.gateway.fm` or testnet equivalent) for smart contract interactions (invokeContract, getContractData, simulateTransaction)

---

## SDK Changes (Complete)

All SDK changes are implemented and tested. See the source files for the full implementation.

### Files Modified

| File | What was added |
|------|----------------|
| `src/types/schemas.ts` | `StellarChainSchema`, `StellarAddressSchema`, `StellarTransferOptionsSchema`, `StellarTrustlineOptionsSchema`, `StellarTrustlineResponseSchema`, `StellarTokensResponseSchema`, `StellarTokenSearchResponseSchema`. Updated `ChainSchema`, `ChainTypeSchema`, `CurrencySchema` (+`XLM`), `MainnetChainSchema`, `TestnetChainSchema`, `AddressSchema`, `SwapOptionsSchema`, `OnrampCryptoOptionsSchema`, `OnrampCryptoResponseSchema`, `CHAIN_IDS` (103/104). |
| `src/tools/definitions.ts` | 5 new tools: `stellar_transfer`, `stellar_swap`, `get_stellar_tokens`, `search_stellar_tokens`, `stellar_add_trustline`. Updated chain enums for: `get_balance`, `bridge`, `get_transaction_status`, `create_crypto_onramp`, `x402_fetch`. |
| `src/tools/executor.ts` | 5 new switch cases routing to: `/api/transfers/stellar`, `/api/transactions/swap`, `/api/stellar/tokens`, `/api/stellar/tokens/search`, `/api/stellar/trustline`. |
| `src/api/transactions.ts` | Stellar branch in `transfer()` — validates XLM/USDC currency, POSTs to `/api/transfers/stellar` via `this.http.post`. Expanded `SwapOptionsSchema` to accept Stellar chains. |
| `src/api/public-tools.ts` | 4 new methods: `stellarTransfer()`, `getStellarTokens()`, `searchStellarTokens()`, `addStellarTrustline()`. All use `this.http.post`/`get` directly (no generated HeyAPI functions — see [OpenAPI note](#openapi-spec-update)). Updated `X402FetchOptions` type. Switched `createOnrampLink` from generated `postApiOnrampCrypto` to `this.http.post` to accommodate wider chain type. |
| `src/client.ts` | 4 new convenience methods: `stellarTransfer()`, `getStellarTokens()`, `searchStellarTokens()`, `addStellarTrustline()`. Updated `onrampCrypto` and `x402Fetch` chain types. |

### Tests (64 total, all passing)

| File | Stellar tests |
|------|---------------|
| `tests/stellar-schemas.test.ts` | 26 tests — address validation (accept/reject), chain schema, transfer options (valid/invalid currency/address), trustline options (valid, empty code, >12 chars, invalid issuer), token response parsing, CHAIN_IDS/CHAIN_NAMES mapping. |
| `tests/tool-executor.test.ts` | 5 tests — routing for `stellar_transfer`, `stellar_swap`, `get_stellar_tokens`, `search_stellar_tokens`, `stellar_add_trustline`. |
| `tests/public-tools.test.ts` | 4 tests — `stellarTransfer`, `addStellarTrustline`, `getStellarTokens`, `searchStellarTokens`. |
| `tests/transactions-transfer.test.ts` | 2 tests — Stellar transfer happy path, unsupported currency rejection. |

### SDK → Backend Contract Summary

The SDK routes to these endpoints and validates responses with these Zod schemas:

| SDK method | HTTP call | Response validated by |
|------------|-----------|----------------------|
| `stellarTransfer()` | `POST /api/transfers/stellar` | `SubmitTransactionSchema` |
| `getStellarTokens()` | `GET /api/stellar/tokens` | `StellarTokensResponseSchema` |
| `searchStellarTokens()` | `GET /api/stellar/tokens/search` | `StellarTokenSearchResponseSchema` |
| `addStellarTrustline()` | `POST /api/stellar/trustline` | `StellarTrustlineResponseSchema` |
| `swap()` (stellar chains) | `POST /api/transactions/swap` | `SwapResponseSchema` (in transactions.ts) |
| `getDetailedBalances()` | `GET /api/balances?chain=stellar` | `DetailedBalancesSchema` |
| `getTransactionStatus()` | `GET /api/transactions/status/{hash}?chain=stellar` | `TransactionStatusResponseSchema` (in transactions.ts) |
| `getTransactionHistoryDetailed()` | `GET /api/transactions/history?chain=stellar` | `TransactionHistoryDetailedSchema` |

---

## Stellar-Specific Considerations

These are the three hardest backend challenges unique to Stellar (no equivalent in Solana or EVM):

### Trustlines

Before a Stellar account can hold any non-XLM asset, it must explicitly **add a trustline** to that asset. This is a transaction that costs a base reserve (0.5 XLM locked). There is no equivalent concept in EVM or Solana — it's closest to Solana ATA creation but is explicit and costs real XLM.

**Two-pronged approach (both required):**

#### 1. Explicit trustline endpoint (SDK tool: `stellar_add_trustline`)

**`POST /api/stellar/trustline`**

```json
// Request
{
  "chain": "stellar" | "stellar-testnet",
  "assetCode": "USDC",              // 1-12 character asset code
  "assetIssuer": "GA5ZSEJYB..."     // Issuer's G-address
}

// Response
{
  "transactionHash": "abc123...",
  "status": "confirmed",
  "assetCode": "USDC",
  "assetIssuer": "GA5ZSEJYB...",
  "explorerUrl": "https://stellar.expert/explorer/public/tx/abc123..."
}
```

**Backend implementation:**
1. Load the agent's Stellar account from Horizon
2. Check if the trustline already exists — if so, return success immediately (idempotent)
3. Build a `ChangeTrust` operation with the `asset_code:asset_issuer` pair and no limit (unlimited trust)
4. Sign with the agent's Ed25519 secret key
5. Submit to Horizon
6. Return the transaction hash and explorer URL

**When the agent uses this:** Proactively opting in to receive an asset before anyone sends it — e.g., "set up my wallet to accept USDC" or "I want to be ready to receive EURC".

**Error cases to handle:**
- Account doesn't exist yet (not funded) → return clear error: "Account must be funded with at least 1 XLM before adding trustlines"
- Insufficient XLM for base reserve → return clear error: "Need at least 0.5 XLM available to add a trustline"
- Asset code too long (>12 chars) → SDK validates this client-side via `StellarTrustlineOptionsSchema`

#### 2. Auto-trustline during transfers (transparent, no SDK tool needed)

When `POST /api/transfers/stellar` is called for a non-XLM currency (e.g., USDC):
1. Check if the **destination** account has a trustline for the asset
2. If not, and the destination is the agent's own wallet, bundle a `ChangeTrust` operation in the same transaction envelope before the `Payment` operation
3. If the destination is an external address without a trustline, fail with a clear error: "Destination does not have a trustline for {assetCode}. The recipient must add one first."

This means an agent receiving USDC via transfer or swap never needs to think about trustlines — the backend handles it. The explicit tool is for the "I want to accept asset X" flow before any transfer occurs.

**Impact on other endpoints:**
- `GET /api/stellar/tokens` — only returns assets with active trustlines (this is how Horizon works by default)
- `POST /api/transactions/swap` — if the output asset requires a trustline the agent doesn't have, auto-add it in the same transaction
- `GET /api/balances?chain=stellar` — same as token list, only trustlined assets appear

### Account Activation

Stellar accounts don't exist on-chain until funded with the minimum base reserve (currently 1 XLM). An unfunded address is just a valid public key with no on-chain state.

**Impact on the backend:**
- When sending XLM to a new address: use `CreateAccount` operation (not `Payment`)
- When sending XLM to an existing address: use `Payment` operation
- Must check account existence via Horizon `GET /accounts/{address}` before building the transaction
- The faucet / initial funding flow must use `CreateAccount`
- Error handling: if the destination doesn't exist and the amount is below the minimum reserve, the transaction will fail — surface a clear error

### Asset Model

Stellar assets are identified by a `code:issuer` pair, not a contract address:

| Concept | EVM | Solana | Stellar |
|---------|-----|--------|---------|
| Token ID | Contract address (`0x...`) | Mint address (Base58) | `code:issuer` pair |
| Native asset | ETH (implicit) | SOL (implicit) | XLM (`native` type) |
| USDC | ERC-20 contract | SPL mint | `USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |
| Opt-in required | No | ATA creation | Trustline |

**Impact on the backend:**
- Token search/listing must handle `asset_code` + `asset_issuer` as a composite key
- Transfers of non-native assets need both code and issuer to identify the asset
- The `currency` field in transfer endpoints works for well-known assets (`XLM`, `USDC`) but the backend must resolve the full `code:issuer` for USDC internally
- For the swap endpoint, input/output tokens may need to accept `code:issuer` format for arbitrary assets

---

## Implementation Status

### SDK (complete)

| Component | Status |
|-----------|--------|
| Type schemas (`schemas.ts`) | Done |
| Tool definitions (`definitions.ts`) | Done |
| Tool executor (`executor.ts`) | Done |
| Transactions API (`transactions.ts`) | Done |
| Public tools API (`public-tools.ts`) | Done |
| Client methods (`client.ts`) | Done |
| Tests (64 total) | Done |

### Backend (not started)

| Endpoint | Priority | Complexity | Status | Notes |
|----------|----------|------------|--------|-------|
| Chain registration (103, 104) | P0 | Low | TODO | Add to chain registry, expose via `GET /api/chains` |
| Wallet generation (Ed25519 → StrKey) | P0 | Medium | TODO | New key type, StrKey encoding |
| `POST /api/transfers/stellar` | P0 | High | TODO | Account existence check, CreateAccount vs Payment, auto-trustline for agent's own wallet |
| `POST /api/stellar/trustline` | P0 | Medium | TODO | ChangeTrust operation, idempotent |
| `GET /api/stellar/tokens` | P1 | Low | TODO | Parse Horizon account balances |
| `GET /api/stellar/tokens/search` | P1 | Medium | TODO | Needs a token directory source |
| `GET /api/balances?chain=stellar` | P1 | Low | TODO | Add Stellar branch to existing balance endpoint |
| `POST /api/transactions/swap` (stellar) | P1 | High | TODO | Horizon path finding, PathPayment operations, auto-trustline |
| `GET /api/transactions/status/{hash}?chain=stellar` | P2 | Low | TODO | Query Horizon, map `successful` flag |
| `GET /api/transactions/history?chain=stellar` | P2 | Medium | TODO | Parse Horizon operations, normalize format |
| `POST /api/faucet/request` (chainId 104) | P2 | Low | TODO | Call Stellar Friendbot |
| `POST /api/wallets/{id}/export-key` (stellar) | P2 | Low | TODO | StrKey `S...` format |
| `POST /api/rpc/{chainId}` (103/104) | P3 | Low | TODO | Proxy to Horizon / Soroban RPC |
| Bridge support (stellar) | P3 | High | TODO | Needs bridge provider integration (Allbridge, etc.) |
| OpenAPI spec update | P1 | Medium | TODO | See [below](#openapi-spec-update) |

### OpenAPI Spec Update

The SDK currently uses `this.http.post`/`this.http.get` directly for all Stellar endpoints because no generated HeyAPI functions exist yet. Once the backend endpoints are built:

1. Add all Stellar endpoints to `openapi.json`
2. Run `bun run generate` to regenerate `src/api/generated/heyapi/`
3. Optionally migrate `public-tools.ts` Stellar methods from `this.http.post/get` to the generated functions (not required — both patterns work, but generated functions provide type-safe request bodies)
4. Note: `createOnrampLink` was already switched from generated `postApiOnrampCrypto` to `this.http.post` because the generated types don't include `"stellar"` in the chain enum. This will resolve itself when the OpenAPI spec is updated.

---

## Endpoint Comparison: Solana vs Stellar

| Aspect | Solana (existing) | Stellar (new) |
|--------|-------------------|---------------|
| **Transfer endpoint** | `POST /api/transfers/solana` | `POST /api/transfers/stellar` |
| **Currency enum** | `SOL`, `USDC` | `XLM`, `USDC` |
| **Token list** | `GET /api/solana/tokens` | `GET /api/stellar/tokens` |
| **Token search** | `GET /api/solana/tokens/search` | `GET /api/stellar/tokens/search` |
| **Swap provider** | Jupiter Aggregator | Stellar DEX (path payments) / Soroban AMMs |
| **Chain values** | `solana`, `solana-devnet` | `stellar`, `stellar-testnet` |
| **Chain IDs** | 101, 102 | 103, 104 |
| **Address format** | Base58 (32-44 chars) | StrKey `G...` (56 chars) |
| **Tx hash format** | Base58 signature | 64 hex chars |
| **Explorer** | `explorer.solana.com/tx/{sig}` | `stellar.expert/explorer/public/tx/{hash}` |
| **Key type** | Ed25519 | Ed25519 |
| **Native RPC** | Solana JSON-RPC | Horizon REST API / Soroban RPC |
| **Token standard** | SPL (mint accounts) | Classic assets (`code:issuer`) + Soroban tokens |
| **Opt-in mechanism** | ATA creation (auto) | Trustline (explicit via `POST /api/stellar/trustline`, or auto during transfers/swaps) |
| **Trustline endpoint** | N/A | `POST /api/stellar/trustline` (SDK tool: `stellar_add_trustline`) |
| **Account existence** | Always exists (system program) | Must be created with min 1 XLM reserve |
| **Testnet faucet** | Solana faucet / airdrop | Friendbot (`friendbot.stellar.org`) |

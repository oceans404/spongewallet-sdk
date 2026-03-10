import { describe, expect, it, vi } from "vitest";
import { PublicToolsApi } from "../src/api/public-tools.js";

describe("PublicToolsApi", () => {
  it("builds balance query params", async () => {
    const http = {
      get: vi.fn().mockResolvedValue({}),
      post: vi.fn(),
    };
    const api = new PublicToolsApi(http as any);

    await api.getDetailedBalances({
      chain: "base",
      allowedChains: ["base", "solana"],
      onlyUsdc: true,
    });

    expect(http.get).toHaveBeenCalledWith("/api/balances", {
      chain: "base",
      allowedChains: "base,solana",
      onlyUsdc: "true",
    });
  });

  it("posts evm transfers to the REST endpoint", async () => {
    const http = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        transactionHash: "0xabc",
        status: "pending",
        explorerUrl: "https://example.com/tx/0xabc",
      }),
    };
    const api = new PublicToolsApi(http as any);

    const result = await api.evmTransfer({
      chain: "base",
      to: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
      amount: "1",
      currency: "USDC",
    });

    expect(result.transactionHash).toBe("0xabc");
    expect(http.post).toHaveBeenCalledWith("/api/transfers/evm", {
      chain: "base",
      to: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
      amount: "1",
      currency: "USDC",
    });
  });

  it("claims signup bonus via the REST endpoint", async () => {
    const http = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        success: true,
        message: "Signup bonus claimed",
        amount: "5",
        currency: "USDC",
        chain: "base",
        recipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
        transactionHash: "0xabc",
        explorerUrl: "https://basescan.org/tx/0xabc",
      }),
    };
    const api = new PublicToolsApi(http as any);

    const result = await api.claimSignupBonus();

    expect(result.success).toBe(true);
    expect(http.post).toHaveBeenCalledWith("/api/signup-bonus/claim", {});
  });

  it("posts stellar transfers to the REST endpoint", async () => {
    const http = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        transactionHash: "abc123stellar",
        status: "pending",
        explorerUrl: "https://stellar.expert/explorer/public/tx/abc123stellar",
      }),
    };
    const api = new PublicToolsApi(http as any);

    const result = await api.stellarTransfer({
      chain: "stellar",
      to: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      amount: "10",
      currency: "XLM",
    });

    expect(result.transactionHash).toBe("abc123stellar");
    expect(http.post).toHaveBeenCalledWith("/api/transfers/stellar", {
      chain: "stellar",
      to: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      amount: "10",
      currency: "XLM",
    });
  });

  it("adds a stellar trustline", async () => {
    const http = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        transactionHash: "trustline123",
        status: "confirmed",
        assetCode: "USDC",
        assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        explorerUrl: "https://stellar.expert/explorer/public/tx/trustline123",
      }),
    };
    const api = new PublicToolsApi(http as any);

    const result = await api.addStellarTrustline({
      chain: "stellar",
      assetCode: "USDC",
      assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    });

    expect(result.transactionHash).toBe("trustline123");
    expect(result.assetCode).toBe("USDC");
    expect(http.post).toHaveBeenCalledWith("/api/stellar/trustline", {
      chain: "stellar",
      assetCode: "USDC",
      assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    });
  });

  it("fetches stellar tokens", async () => {
    const http = {
      get: vi.fn().mockResolvedValue({
        address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        tokens: [],
      }),
      post: vi.fn(),
    };
    const api = new PublicToolsApi(http as any);

    const result = await api.getStellarTokens("stellar");

    expect(result.address).toBe("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7");
    expect(http.get).toHaveBeenCalledWith("/api/stellar/tokens", {
      chain: "stellar",
    });
  });

  it("searches stellar tokens", async () => {
    const http = {
      get: vi.fn().mockResolvedValue({
        tokens: [
          {
            assetCode: "USDC",
            assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            symbol: "USDC",
            name: "USD Coin",
            decimals: 7,
            logoURI: null,
          },
        ],
      }),
      post: vi.fn(),
    };
    const api = new PublicToolsApi(http as any);

    const result = await api.searchStellarTokens("USDC", 5);

    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].assetCode).toBe("USDC");
    expect(http.get).toHaveBeenCalledWith("/api/stellar/tokens/search", {
      query: "USDC",
      limit: "5",
    });
  });

  it("posts x402 fetch requests to the REST endpoint", async () => {
    const http = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        data: { hello: "world" },
      }),
    };
    const api = new PublicToolsApi(http as any);

    const result = await api.x402Fetch({
      url: "https://paid.example.com/data",
      method: "GET",
      preferred_chain: "base",
    });

    expect(result).toEqual({
      ok: true,
      status: 200,
      data: { hello: "world" },
    });
    expect(http.post).toHaveBeenCalledWith("/api/x402/fetch", {
      url: "https://paid.example.com/data",
      method: "GET",
      preferred_chain: "base",
    });
  });

  it("supports preferredChain and defaults method to GET", async () => {
    const http = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ ok: true }),
    };
    const api = new PublicToolsApi(http as any);

    await api.x402Fetch({
      url: "https://paid.example.com/other",
      preferredChain: "solana",
    });

    expect(http.post).toHaveBeenCalledWith("/api/x402/fetch", {
      url: "https://paid.example.com/other",
      method: "GET",
      preferred_chain: "solana",
    });
  });
});

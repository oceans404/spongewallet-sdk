import { describe, expect, it, vi } from "vitest";
import { TransactionsApi } from "../src/api/transactions.js";

describe("TransactionsApi.transfer", () => {
  it("uses /api/transfers/evm for EVM chains", async () => {
    const http = {
      post: vi.fn().mockResolvedValue({
        transactionHash: "0xabc",
        status: "pending",
        explorerUrl: "https://example.com/tx/0xabc",
      }),
      get: vi.fn(),
    };
    const api = new TransactionsApi(http as any, "agent-1");

    const result = await api.transfer({
      chain: "base",
      to: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
      amount: "1",
      currency: "USDC",
    });

    expect(result.txHash).toBe("0xabc");
    expect(http.post).toHaveBeenCalledWith("/api/transfers/evm", {
      chain: "base",
      to: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
      amount: "1",
      currency: "USDC",
    });
  });

  it("uses /api/transfers/solana for Solana chains", async () => {
    const http = {
      post: vi.fn().mockResolvedValue({
        transactionHash: "5h3GQy",
        status: "pending",
      }),
      get: vi.fn(),
    };
    const api = new TransactionsApi(http as any, "agent-1");

    const result = await api.transfer({
      chain: "solana",
      to: "11111111111111111111111111111111",
      amount: "1",
      currency: "SOL",
    });

    expect(result.txHash).toBe("5h3GQy");
    expect(http.post).toHaveBeenCalledWith("/api/transfers/solana", {
      chain: "solana",
      to: "11111111111111111111111111111111",
      amount: "1",
      currency: "SOL",
    });
  });

  it("uses /api/transfers/tempo for pathUSD on tempo", async () => {
    const http = {
      post: vi.fn().mockResolvedValue({
        transactionHash: "0xtempo",
        status: "pending",
      }),
      get: vi.fn(),
    };
    const api = new TransactionsApi(http as any, "agent-1");

    const result = await api.transfer({
      chain: "tempo",
      to: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
      amount: "2",
      currency: "pathUSD",
    });

    expect(result.txHash).toBe("0xtempo");
    expect(http.post).toHaveBeenCalledWith("/api/transfers/tempo", {
      chain: "tempo",
      to: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
      amount: "2",
      use_gas_sponsorship: true,
    });
  });

  it("uses /api/transfers/tempo for pathUSD on tempo-mainnet", async () => {
    const http = {
      post: vi.fn().mockResolvedValue({
        transactionHash: "0xtempo-mainnet",
        status: "pending",
      }),
      get: vi.fn(),
    };
    const api = new TransactionsApi(http as any, "agent-1");

    const result = await api.transfer({
      chain: "tempo-mainnet",
      to: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
      amount: "2",
      currency: "pathUSD",
    });

    expect(result.txHash).toBe("0xtempo-mainnet");
    expect(http.post).toHaveBeenCalledWith("/api/transfers/tempo", {
      chain: "tempo-mainnet",
      to: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
      amount: "2",
      use_gas_sponsorship: true,
    });
  });

  it("uses /api/transfers/stellar for Stellar chains", async () => {
    const http = {
      post: vi.fn().mockResolvedValue({
        transactionHash: "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
        status: "pending",
      }),
      get: vi.fn(),
    };
    const api = new TransactionsApi(http as any, "agent-1");

    const result = await api.transfer({
      chain: "stellar",
      to: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      amount: "10",
      currency: "XLM",
    });

    expect(result.txHash).toBe("abc123def456abc123def456abc123def456abc123def456abc123def456abcd");
    expect(http.post).toHaveBeenCalledWith("/api/transfers/stellar", {
      chain: "stellar",
      to: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      amount: "10",
      currency: "XLM",
    });
  });

  it("rejects unsupported currency for Stellar chains", async () => {
    const http = {
      post: vi.fn(),
      get: vi.fn(),
    };
    const api = new TransactionsApi(http as any, "agent-1");

    await expect(
      api.transfer({
        chain: "stellar",
        to: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        amount: "10",
        currency: "ETH",
      }),
    ).rejects.toThrow("Currency ETH not supported on stellar");
  });

  it("rejects unsupported currency for EVM chains", async () => {
    const http = {
      post: vi.fn(),
      get: vi.fn(),
    };
    const api = new TransactionsApi(http as any, "agent-1");

    await expect(
      api.transfer({
        chain: "base",
        to: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
        amount: "1",
        currency: "SOL",
      }),
    ).rejects.toThrow("Currency SOL not supported on base");
  });
});

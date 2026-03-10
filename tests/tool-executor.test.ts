import { describe, expect, it, vi } from "vitest";
import { ToolExecutor } from "../src/tools/executor.js";
import { TOOL_DEFINITIONS } from "../src/tools/definitions.js";

describe("ToolExecutor", () => {
  it("routes get_balance to /api/balances", async () => {
    const http = {
      get: vi.fn().mockResolvedValue({}),
      post: vi.fn(),
    };
    const executor = new ToolExecutor(http as any, "agent-1");

    const result = await executor.execute("get_balance", {
      chain: "base",
      allowedChains: ["base", "solana"],
      onlyUsdc: true,
    });

    expect(result.status).toBe("success");
    expect(http.get).toHaveBeenCalledWith("/api/balances", {
      chain: "base",
      allowedChains: "base,solana",
      onlyUsdc: "true",
    });
  });

  it("returns error when transaction status lacks chain", async () => {
    const http = {
      get: vi.fn(),
      post: vi.fn(),
    };
    const executor = new ToolExecutor(http as any, "agent-1");

    const result = await executor.execute("get_transaction_status", {
      txHash: "0xabc",
    });

    expect(result.status).toBe("error");
  });

  it("routes claim_signup_bonus to /api/signup-bonus/claim", async () => {
    const claimEnabled = TOOL_DEFINITIONS.some(
      (tool) => tool.name === "claim_signup_bonus"
    );
    const http = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ success: true }),
    };
    const executor = new ToolExecutor(http as any, "agent-1");

    const result = await executor.execute("claim_signup_bonus", {});

    if (!claimEnabled) {
      expect(result.status).toBe("error");
      expect(http.post).not.toHaveBeenCalled();
      return;
    }

    expect(result.status).toBe("success");
    expect(http.post).toHaveBeenCalledWith("/api/signup-bonus/claim", {});
  });

  it("routes x402_fetch to /api/x402/fetch", async () => {
    const http = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ ok: true }),
    };
    const executor = new ToolExecutor(http as any, "agent-1");

    const result = await executor.execute("x402_fetch", {
      url: "https://paid.example.com/data",
      method: "GET",
      preferred_chain: "base",
    });

    expect(result.status).toBe("success");
    expect(http.post).toHaveBeenCalledWith("/api/x402/fetch", {
      url: "https://paid.example.com/data",
      method: "GET",
      headers: undefined,
      body: undefined,
      preferred_chain: "base",
    });
  });

  it("routes store_key to /api/agent-keys", async () => {
    const http = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ success: true }),
    };
    const executor = new ToolExecutor(http as any, "agent-1");

    const result = await executor.execute("store_key", {
      service: "openai",
      key: "sk-test-123",
      label: "primary",
    });

    expect(result.status).toBe("success");
    expect(http.post).toHaveBeenCalledWith("/api/agent-keys", {
      service: "openai",
      key: "sk-test-123",
      label: "primary",
      metadata: undefined,
    });
  });

  it("routes store_credit_card to /api/credit-cards", async () => {
    const http = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ success: true }),
    };
    const executor = new ToolExecutor(http as any, "agent-1");

    const result = await executor.execute("store_credit_card", {
      card_number: "4111111111111111",
      expiration: "12/2030",
      cvc: "123",
      cardholder_name: "Jane Doe",
      email: "jane@example.com",
      billing_address: {
        line1: "123 Main St",
        city: "San Francisco",
        state: "CA",
        postal_code: "94105",
        country: "US",
      },
      shipping_address: {
        line1: "456 Market St",
        city: "San Francisco",
        state: "CA",
        postal_code: "94107",
        country: "US",
      },
      label: "personal",
    });

    expect(result.status).toBe("success");
    expect(http.post).toHaveBeenCalledWith("/api/credit-cards", {
      card_number: "4111111111111111",
      expiry_month: undefined,
      expiry_year: undefined,
      expiration: "12/2030",
      cvc: "123",
      cardholder_name: "Jane Doe",
      email: "jane@example.com",
      billing_address: {
        line1: "123 Main St",
        city: "San Francisco",
        state: "CA",
        postal_code: "94105",
        country: "US",
      },
      shipping_address: {
        line1: "456 Market St",
        city: "San Francisco",
        state: "CA",
        postal_code: "94107",
        country: "US",
      },
      label: "personal",
      metadata: undefined,
    });
  });

  it("routes get_key_value to /api/agent-keys/value", async () => {
    const http = {
      get: vi.fn().mockResolvedValue({ key: { service: "openai", key: "sk" } }),
      post: vi.fn(),
    };
    const executor = new ToolExecutor(http as any, "agent-1");

    const result = await executor.execute("get_key_value", {
      service: "openai",
    });

    expect(result.status).toBe("success");
    expect(http.get).toHaveBeenCalledWith("/api/agent-keys/value", {
      service: "openai",
    });
  });

  it("routes stellar_transfer to /api/transfers/stellar", async () => {
    const http = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ ok: true }),
    };
    const executor = new ToolExecutor(http as any, "agent-1");

    const result = await executor.execute("stellar_transfer", {
      chain: "stellar",
      to: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      amount: "10",
      currency: "XLM",
    });

    expect(result.status).toBe("success");
    expect(http.post).toHaveBeenCalledWith("/api/transfers/stellar", {
      chain: "stellar",
      to: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      amount: "10",
      currency: "XLM",
    });
  });

  it("routes stellar_swap to /api/transactions/swap", async () => {
    const http = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ ok: true }),
    };
    const executor = new ToolExecutor(http as any, "agent-1");

    const result = await executor.execute("stellar_swap", {
      chain: "stellar",
      inputToken: "XLM",
      outputToken: "USDC",
      amount: "100",
    });

    expect(result.status).toBe("success");
    expect(http.post).toHaveBeenCalledWith("/api/transactions/swap", {
      chain: "stellar",
      inputToken: "XLM",
      outputToken: "USDC",
      amount: "100",
      slippageBps: undefined,
    });
  });

  it("routes get_stellar_tokens to /api/stellar/tokens", async () => {
    const http = {
      get: vi.fn().mockResolvedValue({ address: "G...", tokens: [] }),
      post: vi.fn(),
    };
    const executor = new ToolExecutor(http as any, "agent-1");

    const result = await executor.execute("get_stellar_tokens", {
      chain: "stellar",
    });

    expect(result.status).toBe("success");
    expect(http.get).toHaveBeenCalledWith("/api/stellar/tokens", {
      chain: "stellar",
    });
  });

  it("routes stellar_add_trustline to /api/stellar/trustline", async () => {
    const http = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        transactionHash: "abc123",
        status: "confirmed",
        assetCode: "USDC",
        assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      }),
    };
    const executor = new ToolExecutor(http as any, "agent-1");

    const result = await executor.execute("stellar_add_trustline", {
      chain: "stellar",
      assetCode: "USDC",
      assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    });

    expect(result.status).toBe("success");
    expect(http.post).toHaveBeenCalledWith("/api/stellar/trustline", {
      chain: "stellar",
      assetCode: "USDC",
      assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    });
  });

  it("routes search_stellar_tokens to /api/stellar/tokens/search", async () => {
    const http = {
      get: vi.fn().mockResolvedValue({ tokens: [] }),
      post: vi.fn(),
    };
    const executor = new ToolExecutor(http as any, "agent-1");

    const result = await executor.execute("search_stellar_tokens", {
      query: "USDC",
      limit: 5,
    });

    expect(result.status).toBe("success");
    expect(http.get).toHaveBeenCalledWith("/api/stellar/tokens/search", {
      query: "USDC",
      limit: "5",
    });
  });

  it("routes get_key_list to /api/agent-keys", async () => {
    const http = {
      get: vi.fn().mockResolvedValue({ keys: [] }),
      post: vi.fn(),
    };
    const executor = new ToolExecutor(http as any, "agent-1");

    const result = await executor.execute("get_key_list", {});

    expect(result.status).toBe("success");
    expect(http.get).toHaveBeenCalledWith("/api/agent-keys", {});
  });
});

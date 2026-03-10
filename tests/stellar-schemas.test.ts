import { describe, expect, it } from "vitest";
import {
  StellarAddressSchema,
  StellarChainSchema,
  StellarTransferOptionsSchema,
  StellarTrustlineOptionsSchema,
  StellarTokensResponseSchema,
  StellarTokenSearchResponseSchema,
  CHAIN_IDS,
  CHAIN_NAMES,
} from "../src/types/schemas.js";

describe("StellarAddressSchema", () => {
  it("accepts a valid Stellar public key", () => {
    expect(() =>
      StellarAddressSchema.parse("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7"),
    ).not.toThrow();
  });

  it("rejects an address missing the G prefix", () => {
    expect(() =>
      StellarAddressSchema.parse("SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7"),
    ).toThrow();
  });

  it("rejects an address that is too short", () => {
    expect(() => StellarAddressSchema.parse("GABC")).toThrow();
  });

  it("rejects an EVM address", () => {
    expect(() =>
      StellarAddressSchema.parse("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"),
    ).toThrow();
  });

  it("rejects a Solana address", () => {
    expect(() =>
      StellarAddressSchema.parse("11111111111111111111111111111111"),
    ).toThrow();
  });

  it("rejects lowercase characters (Stellar uses base32 uppercase)", () => {
    expect(() =>
      StellarAddressSchema.parse("Gaazi4tcr3ty5ojhctjc2a4qsy6cjwjh5iajtgkin2er7lbnvkoccwn7"),
    ).toThrow();
  });
});

describe("StellarChainSchema", () => {
  it("accepts stellar", () => {
    expect(StellarChainSchema.parse("stellar")).toBe("stellar");
  });

  it("accepts stellar-testnet", () => {
    expect(StellarChainSchema.parse("stellar-testnet")).toBe("stellar-testnet");
  });

  it("rejects solana", () => {
    expect(() => StellarChainSchema.parse("solana")).toThrow();
  });
});

describe("StellarTransferOptionsSchema", () => {
  const validTransfer = {
    chain: "stellar",
    to: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
    amount: "10",
    currency: "XLM",
  };

  it("accepts valid XLM transfer", () => {
    expect(() => StellarTransferOptionsSchema.parse(validTransfer)).not.toThrow();
  });

  it("accepts valid USDC transfer", () => {
    expect(() =>
      StellarTransferOptionsSchema.parse({ ...validTransfer, currency: "USDC" }),
    ).not.toThrow();
  });

  it("rejects ETH currency on Stellar", () => {
    expect(() =>
      StellarTransferOptionsSchema.parse({ ...validTransfer, currency: "ETH" }),
    ).toThrow();
  });

  it("rejects SOL currency on Stellar", () => {
    expect(() =>
      StellarTransferOptionsSchema.parse({ ...validTransfer, currency: "SOL" }),
    ).toThrow();
  });

  it("rejects an EVM address as recipient", () => {
    expect(() =>
      StellarTransferOptionsSchema.parse({
        ...validTransfer,
        to: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
      }),
    ).toThrow();
  });
});

describe("StellarTrustlineOptionsSchema", () => {
  const validTrustline = {
    chain: "stellar",
    assetCode: "USDC",
    assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  };

  it("accepts valid trustline options", () => {
    expect(() => StellarTrustlineOptionsSchema.parse(validTrustline)).not.toThrow();
  });

  it("accepts 12-character asset codes", () => {
    expect(() =>
      StellarTrustlineOptionsSchema.parse({ ...validTrustline, assetCode: "ABCDEFGHIJKL" }),
    ).not.toThrow();
  });

  it("rejects empty asset code", () => {
    expect(() =>
      StellarTrustlineOptionsSchema.parse({ ...validTrustline, assetCode: "" }),
    ).toThrow();
  });

  it("rejects asset code longer than 12 characters", () => {
    expect(() =>
      StellarTrustlineOptionsSchema.parse({ ...validTrustline, assetCode: "ABCDEFGHIJKLM" }),
    ).toThrow();
  });

  it("rejects invalid issuer address", () => {
    expect(() =>
      StellarTrustlineOptionsSchema.parse({ ...validTrustline, assetIssuer: "not-an-address" }),
    ).toThrow();
  });

  it("accepts stellar-testnet chain", () => {
    expect(() =>
      StellarTrustlineOptionsSchema.parse({ ...validTrustline, chain: "stellar-testnet" }),
    ).not.toThrow();
  });
});

describe("StellarTokensResponseSchema", () => {
  it("parses a valid tokens response", () => {
    const response = StellarTokensResponseSchema.parse({
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      tokens: [
        {
          assetCode: "XLM",
          assetIssuer: null,
          symbol: "XLM",
          name: "Stellar Lumens",
          balance: "100.0000000",
          decimals: 7,
          logoURI: null,
        },
      ],
    });
    expect(response.tokens).toHaveLength(1);
    expect(response.tokens[0].assetIssuer).toBeNull();
  });
});

describe("StellarTokenSearchResponseSchema", () => {
  it("parses a valid search response", () => {
    const response = StellarTokenSearchResponseSchema.parse({
      tokens: [
        {
          assetCode: "USDC",
          assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          symbol: "USDC",
          name: "USD Coin",
          decimals: 7,
          logoURI: "https://example.com/usdc.png",
        },
      ],
    });
    expect(response.tokens).toHaveLength(1);
  });
});

describe("CHAIN_IDS", () => {
  it("maps stellar to 103", () => {
    expect(CHAIN_IDS["stellar"]).toBe(103);
  });

  it("maps stellar-testnet to 104", () => {
    expect(CHAIN_IDS["stellar-testnet"]).toBe(104);
  });
});

describe("CHAIN_NAMES", () => {
  it("maps 103 to stellar", () => {
    expect(CHAIN_NAMES[103]).toBe("stellar");
  });

  it("maps 104 to stellar-testnet", () => {
    expect(CHAIN_NAMES[104]).toBe("stellar-testnet");
  });
});

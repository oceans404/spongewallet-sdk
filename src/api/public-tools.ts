import {
  DetailedBalancesSchema,
  EvmTransferOptionsSchema,
  SolanaTransferOptionsSchema,
  StellarTransferOptionsSchema,
  StellarTrustlineOptionsSchema,
  StellarTrustlineResponseSchema,
  SubmitTransactionSchema,
  SolanaTokensResponseSchema,
  SolanaTokenSearchResponseSchema,
  StellarTokensResponseSchema,
  StellarTokenSearchResponseSchema,
  OnrampCryptoOptionsSchema,
  OnrampCryptoResponseSchema,
  SignupBonusClaimResponseSchema,
  TransactionHistoryDetailedSchema,
  SpongeResponseSchema,
  X402PaymentResponseSchema,
  type Chain,
  type EvmTransferOptions,
  type SolanaTransferOptions,
  type StellarTransferOptions,
  type StellarTrustlineOptions,
  type StellarTrustlineResponse,
  type SubmitTransaction,
  type DetailedBalances,
  type SolanaTokensResponse,
  type SolanaTokenSearchResponse,
  type StellarTokensResponse,
  type StellarTokenSearchResponse,
  type OnrampCryptoOptions,
  type OnrampCryptoResponse,
  type SignupBonusClaimResponse,
  type TransactionHistoryDetailed,
  type SpongeResponse,
  type X402PaymentResponse,
  type SolanaChain,
  type StellarChain,
} from "../types/schemas.js";
import type { HttpClient } from "./http.js";
import {
  getApiBalances,
  getApiSolanaTokens,
  getApiSolanaTokensSearch,
  getApiTransactionsHistory,
  postApiSignupBonusClaim,
  postApiTransfersEvm,
  postApiTransfersSolana,
  postApiX402Payments,
} from "./generated/heyapi/sdk.gen.js";
import { getHeyApiClient } from "./generated/heyapi-adapter.js";

export interface DetailedBalanceOptions {
  chain?: Chain | "all";
  allowedChains?: Chain[];
  onlyUsdc?: boolean;
}

export interface TransactionHistoryDetailedOptions {
  limit?: number;
  chain?: Chain;
}

export interface SpongeRequest {
  [key: string]: unknown;
}

export interface CreateX402PaymentOptions {
  chain: Chain;
  to: string;
  token?: string;
  amount: string;
  decimals?: number;
  valid_for_seconds?: number;
  resource_url?: string;
  resource_description?: string;
  fee_payer?: string;
  http_method?: "GET" | "POST";
}

export interface X402FetchOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
  preferredChain?: "base" | "solana" | "ethereum" | "stellar";
  preferred_chain?: "base" | "solana" | "ethereum" | "stellar";
}

export class PublicToolsApi {
  constructor(private readonly http: HttpClient) {}

  async getDetailedBalances(options: DetailedBalanceOptions = {}): Promise<DetailedBalances> {
    const params: Record<string, string> = {};
    if (options.chain) {
      params.chain = options.chain;
    }
    if (options.allowedChains?.length) {
      params.allowedChains = options.allowedChains.join(",");
    }
    if (options.onlyUsdc) {
      params.onlyUsdc = "true";
    }

    const response = await getApiBalances({
      client: getHeyApiClient(this.http),
      query: params,
    });
    return DetailedBalancesSchema.parse(response);
  }

  async evmTransfer(options: EvmTransferOptions): Promise<SubmitTransaction> {
    const validated = EvmTransferOptionsSchema.parse(options);
    const response = await postApiTransfersEvm({
      client: getHeyApiClient(this.http),
      body: validated,
    });
    return SubmitTransactionSchema.parse(response);
  }

  async solanaTransfer(options: SolanaTransferOptions): Promise<SubmitTransaction> {
    const validated = SolanaTransferOptionsSchema.parse(options);
    const response = await postApiTransfersSolana({
      client: getHeyApiClient(this.http),
      body: validated,
    });
    return SubmitTransactionSchema.parse(response);
  }

  async getSolanaTokens(chain: SolanaChain): Promise<SolanaTokensResponse> {
    const response = await getApiSolanaTokens({
      client: getHeyApiClient(this.http),
      query: { chain },
    });
    return SolanaTokensResponseSchema.parse(response);
  }

  async searchSolanaTokens(query: string, limit?: number): Promise<SolanaTokenSearchResponse> {
    const params: { query: string; limit?: string } = { query };
    if (limit !== undefined) params.limit = limit.toString();
    const response = await getApiSolanaTokensSearch({
      client: getHeyApiClient(this.http),
      query: params,
    });
    return SolanaTokenSearchResponseSchema.parse(response);
  }

  async stellarTransfer(options: StellarTransferOptions): Promise<SubmitTransaction> {
    const validated = StellarTransferOptionsSchema.parse(options);
    const response = await this.http.post<unknown>("/api/transfers/stellar", validated);
    return SubmitTransactionSchema.parse(response);
  }

  async getStellarTokens(chain: StellarChain): Promise<StellarTokensResponse> {
    const response = await this.http.get<unknown>("/api/stellar/tokens", { chain });
    return StellarTokensResponseSchema.parse(response);
  }

  async searchStellarTokens(query: string, limit?: number): Promise<StellarTokenSearchResponse> {
    const params: Record<string, string> = { query };
    if (limit !== undefined) params.limit = limit.toString();
    const response = await this.http.get<unknown>("/api/stellar/tokens/search", params);
    return StellarTokenSearchResponseSchema.parse(response);
  }

  async addStellarTrustline(options: StellarTrustlineOptions): Promise<StellarTrustlineResponse> {
    const validated = StellarTrustlineOptionsSchema.parse(options);
    const response = await this.http.post<unknown>("/api/stellar/trustline", validated);
    return StellarTrustlineResponseSchema.parse(response);
  }

  async getTransactionHistoryDetailed(
    options: TransactionHistoryDetailedOptions = {},
  ): Promise<TransactionHistoryDetailed> {
    const params: Record<string, string> = {};
    if (options.limit !== undefined) params.limit = options.limit.toString();
    if (options.chain) params.chain = options.chain;
    const response = await getApiTransactionsHistory({
      client: getHeyApiClient(this.http),
      query: params,
    });
    return TransactionHistoryDetailedSchema.parse(response);
  }

  async createOnrampLink(options: OnrampCryptoOptions): Promise<OnrampCryptoResponse> {
    const validated = OnrampCryptoOptionsSchema.parse(options);
    const response = await this.http.post<unknown>("/api/onramp/crypto", validated);
    return OnrampCryptoResponseSchema.parse(response);
  }

  async claimSignupBonus(): Promise<SignupBonusClaimResponse> {
    const response = await postApiSignupBonusClaim({
      client: getHeyApiClient(this.http),
      body: {},
    });
    return SignupBonusClaimResponseSchema.parse(response);
  }

  async sponge(request: SpongeRequest): Promise<SpongeResponse> {
    const response = await this.http.post<unknown>("/api/sponge", request);
    return SpongeResponseSchema.parse(response);
  }

  async createX402Payment(options: CreateX402PaymentOptions): Promise<X402PaymentResponse> {
    const response = await postApiX402Payments({
      client: getHeyApiClient(this.http),
      body: options,
    });
    return X402PaymentResponseSchema.parse(response);
  }

  async x402Fetch(options: X402FetchOptions): Promise<unknown> {
    const {
      preferredChain,
      preferred_chain,
      method = "GET",
      ...rest
    } = options;

    return this.http.post<unknown>("/api/x402/fetch", {
      ...rest,
      method,
      preferred_chain: preferred_chain ?? preferredChain,
    });
  }
}

/**
 * Gestão de token OAuth 2.0 (Client Credentials).
 *
 * Fluxo: `POST {baseUrl}/authenticate` com `client_id` + `client_secret` +
 * `grant_type=client_credentials` (form-urlencoded) e header `X-Token`.
 * Resposta: `{ access_token, expires_in, token_type }`.
 *
 * O JWT é cacheado e renovado automaticamente ANTES de expirar (com folga
 * configurável). Chamadas concorrentes compartilham uma única renovação em voo.
 * Segredos e o JWT são registrados para redação e NUNCA são logados.
 *
 * Doc: https://developer.sankhya.com.br/reference/autenticação
 */
import type { SankhyaConfig } from './config.js';
import { SankhyaAuthError } from './errors.js';
import { httpRequest, tryParseJson, type FetchLike } from './http.js';
import { registerSecret, unregisterSecret } from './redact.js';

/** Relógio injetável (testes determinísticos). */
export type Clock = () => number;

interface AuthResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
}

interface CachedToken {
  accessToken: string;
  tokenType: string;
  /** Timestamp (ms) em que o token expira de fato. */
  expiresAtMs: number;
}

export interface TokenManagerOptions {
  config: SankhyaConfig;
  fetchImpl?: FetchLike;
  clock?: Clock;
}

export class TokenManager {
  private readonly config: SankhyaConfig;
  private readonly fetchImpl: FetchLike;
  private readonly clock: Clock;

  private cached: CachedToken | undefined;
  /** Renovação em voo, para deduplicar chamadas concorrentes. */
  private inFlight: Promise<CachedToken> | undefined;

  constructor(options: TokenManagerOptions) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.clock = options.clock ?? Date.now;
  }

  /**
   * Retorna um JWT válido, renovando se necessário. Seguro para chamadas
   * concorrentes. Lança `SankhyaAuthError` em falha de autenticação.
   */
  async getAccessToken(): Promise<string> {
    const token = await this.getValidToken();
    return token.accessToken;
  }

  /** Cabeçalho `Authorization` pronto para uso. */
  async getAuthorizationHeader(): Promise<string> {
    const token = await this.getValidToken();
    return `${token.tokenType} ${token.accessToken}`;
  }

  /** Invalida o token cacheado, forçando renovação na próxima chamada. */
  invalidate(): void {
    if (this.cached) {
      unregisterSecret(this.cached.accessToken);
    }
    this.cached = undefined;
  }

  private async getValidToken(): Promise<CachedToken> {
    if (this.cached && !this.isExpiring(this.cached)) {
      return this.cached;
    }
    if (this.inFlight) {
      return this.inFlight;
    }
    this.inFlight = this.authenticate()
      .then((token) => {
        this.cached = token;
        return token;
      })
      .finally(() => {
        this.inFlight = undefined;
      });
    return this.inFlight;
  }

  private isExpiring(token: CachedToken): boolean {
    const skewMs = this.config.tokenRefreshSkewSeconds * 1000;
    return this.clock() >= token.expiresAtMs - skewMs;
  }

  private async authenticate(): Promise<CachedToken> {
    const url = `${this.config.baseUrl}/authenticate`;
    const form = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const response = await httpRequest(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // X-Token autentica a aplicação no portal de desenvolvedores.
          'X-Token': this.config.xToken,
          Accept: 'application/json',
        },
        body: form.toString(),
        timeoutMs: this.config.httpTimeoutMs,
      },
      this.fetchImpl,
    );

    if (!response.ok) {
      // Não incluímos o corpo cru para evitar vazamento acidental.
      throw new SankhyaAuthError(
        `Falha na autenticação (HTTP ${response.status}). Verifique client_id, client_secret e X-Token.`,
      );
    }

    const body = tryParseJson(response.text) as AuthResponse | undefined;
    if (!body?.access_token) {
      throw new SankhyaAuthError('Resposta de autenticação sem access_token.');
    }

    const expiresInSec =
      typeof body.expires_in === 'number' && body.expires_in > 0 ? body.expires_in : 3600;
    const token: CachedToken = {
      accessToken: body.access_token,
      tokenType: body.token_type?.trim() || 'Bearer',
      expiresAtMs: this.clock() + expiresInSec * 1000,
    };

    registerSecret(token.accessToken);
    return token;
  }
}

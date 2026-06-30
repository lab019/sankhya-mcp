import { describe, it, expect, beforeEach } from 'vitest';
import { TokenManager } from '../src/auth.js';
import { SankhyaAuthError } from '../src/errors.js';
import { clearSecrets } from '../src/redact.js';
import type { SankhyaConfig } from '../src/config.js';
import type { FetchLike } from '../src/http.js';

function makeConfig(overrides: Partial<SankhyaConfig> = {}): SankhyaConfig {
  return {
    clientId: 'cid',
    clientSecret: 'csecret',
    xToken: 'xtok',
    env: 'sandbox',
    baseUrl: 'https://api.sandbox.sankhya.com.br',
    tokenRefreshSkewSeconds: 60,
    httpTimeoutMs: 30_000,
    ...overrides,
  };
}

interface Capture {
  url: string;
  init?: RequestInit;
}

function fetchReturning(body: unknown, status = 200, captures: Capture[] = []): FetchLike {
  return async (url, init) => {
    captures.push({ url: String(url), init });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

describe('TokenManager', () => {
  beforeEach(() => clearSecrets());

  it('autentica com form-urlencoded, X-Token e grant_type correto', async () => {
    const captures: Capture[] = [];
    const tm = new TokenManager({
      config: makeConfig(),
      fetchImpl: fetchReturning({ access_token: 'jwt-1', expires_in: 3600 }, 200, captures),
      clock: () => 1_000_000,
    });

    const token = await tm.getAccessToken();
    expect(token).toBe('jwt-1');

    const call = captures[0]!;
    expect(call.url).toBe('https://api.sandbox.sankhya.com.br/authenticate');
    expect(call.init?.method).toBe('POST');
    const headers = call.init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(headers['X-Token']).toBe('xtok');
    const body = String(call.init?.body);
    expect(body).toContain('grant_type=client_credentials');
    expect(body).toContain('client_id=cid');
    expect(body).toContain('client_secret=csecret');
  });

  it('cacheia o token e não re-autentica enquanto válido', async () => {
    const captures: Capture[] = [];
    const tm = new TokenManager({
      config: makeConfig(),
      fetchImpl: fetchReturning({ access_token: 'jwt-1', expires_in: 3600 }, 200, captures),
      clock: () => 1_000_000,
    });
    await tm.getAccessToken();
    await tm.getAccessToken();
    expect(captures).toHaveLength(1);
  });

  it('renova antes de expirar respeitando a folga (skew)', async () => {
    let now = 0;
    let counter = 0;
    const fetchImpl: FetchLike = async () => {
      counter += 1;
      return new Response(JSON.stringify({ access_token: `jwt-${counter}`, expires_in: 100 }), {
        status: 200,
      });
    };
    const tm = new TokenManager({
      config: makeConfig({ tokenRefreshSkewSeconds: 10 }),
      fetchImpl,
      clock: () => now,
    });

    expect(await tm.getAccessToken()).toBe('jwt-1'); // expira em 100s
    now = 80_000; // ainda dentro da janela (100 - 10 = 90s)
    expect(await tm.getAccessToken()).toBe('jwt-1');
    now = 95_000; // passou do limite de renovação (90s)
    expect(await tm.getAccessToken()).toBe('jwt-2');
  });

  it('deduplica autenticações concorrentes', async () => {
    let counter = 0;
    const fetchImpl: FetchLike = async () => {
      counter += 1;
      return new Response(JSON.stringify({ access_token: `jwt-${counter}`, expires_in: 3600 }), {
        status: 200,
      });
    };
    const tm = new TokenManager({ config: makeConfig(), fetchImpl, clock: () => 0 });
    const [a, b, c] = await Promise.all([
      tm.getAccessToken(),
      tm.getAccessToken(),
      tm.getAccessToken(),
    ]);
    expect([a, b, c]).toEqual(['jwt-1', 'jwt-1', 'jwt-1']);
    expect(counter).toBe(1);
  });

  it('invalidate força nova autenticação', async () => {
    const captures: Capture[] = [];
    const tm = new TokenManager({
      config: makeConfig(),
      fetchImpl: fetchReturning({ access_token: 'jwt-1', expires_in: 3600 }, 200, captures),
      clock: () => 0,
    });
    await tm.getAccessToken();
    tm.invalidate();
    await tm.getAccessToken();
    expect(captures).toHaveLength(2);
  });

  it('lança SankhyaAuthError em HTTP não-ok sem vazar corpo', async () => {
    const tm = new TokenManager({
      config: makeConfig(),
      fetchImpl: fetchReturning({ error: 'invalid_client' }, 401),
      clock: () => 0,
    });
    await expect(tm.getAccessToken()).rejects.toBeInstanceOf(SankhyaAuthError);
  });

  it('lança quando a resposta não tem access_token', async () => {
    const tm = new TokenManager({
      config: makeConfig(),
      fetchImpl: fetchReturning({ token_type: 'Bearer' }, 200),
      clock: () => 0,
    });
    await expect(tm.getAccessToken()).rejects.toBeInstanceOf(SankhyaAuthError);
  });

  it('monta o header Authorization com o token_type retornado', async () => {
    const tm = new TokenManager({
      config: makeConfig(),
      fetchImpl: fetchReturning({ access_token: 'jwt-1', expires_in: 3600, token_type: 'Bearer' }),
      clock: () => 0,
    });
    expect(await tm.getAuthorizationHeader()).toBe('Bearer jwt-1');
  });
});

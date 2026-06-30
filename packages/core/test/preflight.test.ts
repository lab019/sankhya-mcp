import { describe, it, expect, beforeEach } from 'vitest';
import { runPreflight } from '../src/preflight.js';
import { clearSecrets } from '../src/redact.js';
import type { SankhyaConfig } from '../src/config.js';
import type { FetchLike } from '../src/http.js';

function makeConfig(): SankhyaConfig {
  return {
    clientId: 'cid',
    clientSecret: 'csecret',
    xToken: 'xtok',
    env: 'sandbox',
    baseUrl: 'https://api.sandbox.sankhya.com.br',
    tokenRefreshSkewSeconds: 60,
    httpTimeoutMs: 30_000,
  };
}

const AUTH_OK = JSON.stringify({ access_token: 'jwt-secreto', expires_in: 3600 });

/** Resposta de loadRecords com `n` registros (entidade `Produto`/`Parceiro`). */
function recordsResponse(n: number): string {
  return JSON.stringify({
    status: '1',
    responseBody: {
      entities: {
        hasMoreResult: 'false',
        metadata: { fields: { field: [{ name: 'CODPROD' }] } },
        entity: Array.from({ length: n }, (_, i) => ({ f0: { $: String(i + 1) } })),
      },
    },
  });
}

/** Constrói um `fetch` falso roteando por URL (auth vs serviço). */
function makeFetch(opts: { auth?: () => Response; data?: () => Response }): {
  fetchImpl: FetchLike;
  calls: string[];
} {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.endsWith('/authenticate')) {
      return (opts.auth ?? (() => new Response(AUTH_OK, { status: 200 })))();
    }
    return (opts.data ?? (() => new Response(recordsResponse(2), { status: 200 })))();
  };
  return { fetchImpl, calls };
}

describe('runPreflight', () => {
  beforeEach(() => clearSecrets());

  it('reporta OK quando autentica e há dados de exemplo', async () => {
    const { fetchImpl } = makeFetch({});
    const report = await runPreflight({
      config: makeConfig(),
      fetchImpl,
      clock: () => 0,
    });

    expect(report.ok).toBe(true);
    expect(report.env).toBe('sandbox');
    expect(report.auth.ok).toBe(true);
    expect(report.auth.tokenType).toBe('Bearer');
    expect(report.auth.expiresInSeconds).toBe(3600);
    // Default: checa Produto e Parceiro.
    expect(report.data.map((d) => d.entity)).toEqual(['Produto', 'Parceiro']);
    expect(report.data.every((d) => d.ok && d.count === 2)).toBe(true);
  });

  it('nunca expõe o JWT nem segredos no relatório', async () => {
    const { fetchImpl } = makeFetch({});
    const report = await runPreflight({ config: makeConfig(), fetchImpl, clock: () => 0 });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('jwt-secreto');
    expect(serialized).not.toContain('csecret');
    expect(serialized).not.toContain('xtok');
  });

  it('falha (sem pular dados) quando o ambiente não tem dados de exemplo', async () => {
    const { fetchImpl } = makeFetch({
      data: () => new Response(recordsResponse(0), { status: 200 }),
    });
    const report = await runPreflight({ config: makeConfig(), fetchImpl, clock: () => 0 });

    expect(report.auth.ok).toBe(true);
    expect(report.ok).toBe(false);
    expect(report.data.every((d) => d.ok === false && d.count === 0 && !d.skipped)).toBe(true);
  });

  it('marca dados como pulados quando a autenticação falha', async () => {
    const { fetchImpl, calls } = makeFetch({
      auth: () => new Response('{}', { status: 401 }),
    });
    const report = await runPreflight({ config: makeConfig(), fetchImpl, clock: () => 0 });

    expect(report.auth.ok).toBe(false);
    expect(report.ok).toBe(false);
    expect(report.data.every((d) => d.skipped === true)).toBe(true);
    // Não deve tentar consultar dados sem token.
    expect(calls.some((u) => u.includes('service.sbr'))).toBe(false);
  });

  it('respeita sampleChecks customizados', async () => {
    const { fetchImpl } = makeFetch({});
    const report = await runPreflight({
      config: makeConfig(),
      fetchImpl,
      clock: () => 0,
      sampleChecks: [{ entity: 'Natureza', fields: ['CODNAT'], label: 'Naturezas' }],
    });

    expect(report.data).toHaveLength(1);
    expect(report.data[0]!.entity).toBe('Natureza');
    expect(report.ok).toBe(true);
  });
});

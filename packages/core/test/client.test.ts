import { describe, it, expect, beforeEach } from 'vitest';
import { SankhyaClient } from '../src/client.js';
import { TokenManager } from '../src/auth.js';
import { SankhyaApiError, SankhyaPolicyError } from '../src/errors.js';
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

interface Capture {
  url: string;
  init?: RequestInit;
}

/** Cria um client com token fixo (sem rede de auth) e fetch capturável. */
function makeClient(
  handler: (call: Capture, index: number) => Response,
  opts: { allowRawSql?: boolean } = {},
): { client: SankhyaClient; calls: Capture[] } {
  const calls: Capture[] = [];
  const config = makeConfig();
  const fetchImpl: FetchLike = async (url, init) => {
    const call = { url: String(url), init };
    calls.push(call);
    return handler(call, calls.length - 1);
  };
  // TokenManager que nunca chama a rede: pré-popula via fetch de auth fake.
  const authFetch: FetchLike = async () =>
    new Response(JSON.stringify({ access_token: 'jwt', expires_in: 3600 }), { status: 200 });
  const tokenManager = new TokenManager({ config, fetchImpl: authFetch, clock: () => 0 });

  const client = new SankhyaClient({
    config,
    fetchImpl,
    tokenManager,
    allowRawSql: opts.allowRawSql,
  });
  return { client, calls };
}

describe('SankhyaClient', () => {
  beforeEach(() => clearSecrets());

  it('monta a URL de serviço do Gateway corretamente', () => {
    const { client } = makeClient(() => new Response('{}'));
    const url = client.buildServiceUrl('mge', 'CRUDServiceProvider.loadRecords');
    expect(url).toBe(
      'https://api.sandbox.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=CRUDServiceProvider.loadRecords&outputType=json',
    );
  });

  it('loadRecords envia body correto e injeta Authorization', async () => {
    const { client, calls } = makeClient(
      () =>
        new Response(
          JSON.stringify({
            status: '1',
            responseBody: { entities: { hasMoreResult: 'false', entity: [] } },
          }),
          { status: 200 },
        ),
    );
    await client.loadRecords({ entity: 'Produto', fields: ['CODPROD'] });
    const call = calls[0]!;
    expect(call.url).toContain('serviceName=CRUDServiceProvider.loadRecords');
    const headers = call.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer jwt');
    const body = JSON.parse(String(call.init?.body));
    expect(body.serviceName).toBe('CRUDServiceProvider.loadRecords');
    expect(body.requestBody.dataSet.rootEntity).toBe('Produto');
  });

  it('renova o token e tenta novamente uma vez em HTTP 401', async () => {
    const { client, calls } = makeClient((_, index) => {
      if (index === 0) return new Response('{}', { status: 401 });
      return new Response(
        JSON.stringify({ status: '1', responseBody: { entities: { entity: [] } } }),
        { status: 200 },
      );
    });
    const result = await client.loadRecords({ entity: 'Produto', fields: ['CODPROD'] });
    expect(result.records).toEqual([]);
    expect(calls).toHaveLength(2); // primeira 401, segunda OK
  });

  it('lança SankhyaApiError quando o envelope tem status != "1"', async () => {
    const { client } = makeClient(
      () =>
        new Response(JSON.stringify({ status: '0', statusMessage: 'erro de regra' }), {
          status: 200,
        }),
    );
    await expect(
      client.loadRecords({ entity: 'Produto', fields: ['CODPROD'] }),
    ).rejects.toBeInstanceOf(SankhyaApiError);
  });

  it('loadRecord filtra pela PK e retorna o primeiro registro', async () => {
    const { client, calls } = makeClient(
      () =>
        new Response(
          JSON.stringify({
            status: '1',
            responseBody: {
              entities: {
                metadata: { fields: { field: [{ name: 'CODPROD' }] } },
                entity: [{ f0: { $: '7' } }],
              },
            },
          }),
          { status: 200 },
        ),
    );
    const rec = await client.loadRecord({ entity: 'Produto', key: { CODPROD: 7 } });
    expect(rec).toEqual({ CODPROD: '7' });
    const body = JSON.parse(String(calls[0]!.init?.body));
    expect(body.requestBody.dataSet.criteria.expression.$).toBe('this.CODPROD = ?');
    expect(body.requestBody.dataSet.criteria.parameter[0]).toEqual({ $: '7', type: 'I' });
  });

  it('executeQuery é bloqueado por padrão (política)', async () => {
    const { client } = makeClient(() => new Response('{}'));
    await expect(client.executeQuery('SELECT 1')).rejects.toBeInstanceOf(SankhyaPolicyError);
  });

  it('executeQuery funciona com allowRawSql=true', async () => {
    const { client, calls } = makeClient(
      () => new Response(JSON.stringify({ status: '1', responseBody: {} }), { status: 200 }),
      { allowRawSql: true },
    );
    await client.executeQuery('SELECT 1');
    const body = JSON.parse(String(calls[0]!.init?.body));
    expect(body.serviceName).toBe('DbExplorerSP.executeQuery');
    expect(body.requestBody.sql).toBe('SELECT 1');
  });
});

/**
 * Camada HTTP de baixo nível: wrapper de `fetch` com timeout (AbortController)
 * e tratamento uniforme de rede. `fetch` é injetável para facilitar testes.
 */
import { SankhyaNetworkError } from './errors.js';

/** Assinatura compatível com o `fetch` global (injetável em testes). */
export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface RequestOptions {
  method: string;
  headers?: Record<string, string>;
  body?: string;
  /** Timeout em ms; 0/omitido = sem timeout explícito. */
  timeoutMs?: number;
}

/** Resposta crua já lida como texto, com metadados úteis. */
export interface RawHttpResponse {
  status: number;
  ok: boolean;
  text: string;
  headers: Headers;
}

/**
 * Executa uma requisição com timeout. Converte falhas de rede/abort em
 * `SankhyaNetworkError` (sem expor segredos). Não interpreta status HTTP —
 * isso é responsabilidade das camadas acima.
 */
export async function httpRequest(
  url: string,
  options: RequestOptions,
  fetchImpl: FetchLike = fetch,
): Promise<RawHttpResponse> {
  const controller = new AbortController();
  const timeout =
    options.timeoutMs && options.timeoutMs > 0
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : undefined;

  try {
    const response = await fetchImpl(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      text,
      headers: response.headers,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new SankhyaNetworkError(
        `Timeout após ${options.timeoutMs}ms ao chamar a API Sankhya.`,
        err,
      );
    }
    throw new SankhyaNetworkError('Falha de rede ao chamar a API Sankhya.', err);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** Faz parse de JSON com tolerância; retorna `undefined` se vazio/ inválido. */
export function tryParseJson(text: string): unknown {
  if (!text || !text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

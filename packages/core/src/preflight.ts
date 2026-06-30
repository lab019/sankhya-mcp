/**
 * Preflight de credenciais (LIC-157).
 *
 * Valida, de forma SEGURA, se um conjunto de credenciais OAuth está pronto para
 * uma demo/PoC contra a API Sankhya:
 *
 * 1. `POST /authenticate` retorna um JWT válido (autenticação).
 * 2. Há dados de exemplo no ambiente (produtos, parceiros) para a demo.
 *
 * NADA sensível é retornado: o relatório contém apenas o ambiente, a base URL,
 * metadados não secretos do token e contagens. Segredos continuam encapsulados
 * no `TokenManager`/`SankhyaClient` e passam pela redação.
 */
import { TokenManager, type Clock } from './auth.js';
import { SankhyaClient } from './client.js';
import type { SankhyaConfig } from './config.js';
import type { FetchLike } from './http.js';
import { redactString } from './redact.js';
import type { SankhyaEnv, SankhyaModule } from './types.js';

/** Especificação de uma checagem de dados de exemplo. */
export interface PreflightSampleSpec {
  /** Entidade a consultar (ex.: `Produto`). */
  entity: string;
  /** Campos mínimos a retornar (a PK basta). */
  fields: string[];
  /** Rótulo amigável para o relatório (ex.: `Produtos`). */
  label: string;
  /** Módulo do gateway. Default herda o do client (`mge`). */
  module?: SankhyaModule;
}

/**
 * Checagens padrão de dados de demo: produtos e parceiros — exatamente os
 * cadastros citados nos critérios de aceite da PoC.
 */
export const DEFAULT_SAMPLE_CHECKS: readonly PreflightSampleSpec[] = [
  { entity: 'Produto', fields: ['CODPROD', 'DESCRPROD'], label: 'Produtos' },
  { entity: 'Parceiro', fields: ['CODPARC', 'NOMEPARC'], label: 'Parceiros' },
];

/** Resultado da checagem de autenticação. */
export interface PreflightAuthCheck {
  ok: boolean;
  /** Tipo do token (ex.: `Bearer`), quando obtido. */
  tokenType?: string;
  /** Segundos até expirar, quando obtido. */
  expiresInSeconds?: number;
  /** Mensagem de erro (já redigida) em caso de falha. */
  error?: string;
}

/** Resultado da checagem de uma entidade de exemplo. */
export interface PreflightDataCheck {
  entity: string;
  label: string;
  /** `true` se ao menos um registro foi encontrado. */
  ok: boolean;
  /** Registros retornados na primeira página (amostra). */
  count: number;
  /** A API indicou que há mais páginas além da amostra. */
  hasMoreResult: boolean;
  /** Checagem pulada (ex.: autenticação falhou antes). */
  skipped?: boolean;
  /** Mensagem de erro (já redigida) em caso de falha. */
  error?: string;
}

/** Relatório completo do preflight (seguro para log/exibição). */
export interface PreflightReport {
  env: SankhyaEnv;
  baseUrl: string;
  auth: PreflightAuthCheck;
  data: PreflightDataCheck[];
  /** Resultado geral: autenticação OK e todas as checagens de dados OK. */
  ok: boolean;
}

export interface PreflightOptions {
  config: SankhyaConfig;
  /** `fetch` injetável (testes). */
  fetchImpl?: FetchLike;
  /** Relógio injetável (testes). */
  clock?: Clock;
  /** Entidades a verificar. Default: `DEFAULT_SAMPLE_CHECKS`. */
  sampleChecks?: readonly PreflightSampleSpec[];
}

/** Extrai uma mensagem de erro segura (sempre redigida). */
function safeErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return redactString(message);
}

async function checkAuth(tokens: TokenManager): Promise<PreflightAuthCheck> {
  try {
    const info = await tokens.getTokenInfo();
    return { ok: true, tokenType: info.tokenType, expiresInSeconds: info.expiresInSeconds };
  } catch (err) {
    return { ok: false, error: safeErrorMessage(err) };
  }
}

async function checkData(
  client: SankhyaClient,
  spec: PreflightSampleSpec,
): Promise<PreflightDataCheck> {
  try {
    const result = await client.loadRecords({
      entity: spec.entity,
      fields: spec.fields,
      offsetPage: 0,
      module: spec.module,
    });
    const count = result.records.length;
    return {
      entity: spec.entity,
      label: spec.label,
      ok: count > 0,
      count,
      hasMoreResult: result.hasMoreResult,
    };
  } catch (err) {
    return {
      entity: spec.entity,
      label: spec.label,
      ok: false,
      count: 0,
      hasMoreResult: false,
      error: safeErrorMessage(err),
    };
  }
}

/**
 * Executa o preflight de credenciais e devolve um relatório seguro.
 *
 * Compartilha um único `TokenManager` entre a checagem de auth e as consultas,
 * então a autenticação ocorre uma vez só. Se a autenticação falhar, as
 * checagens de dados são marcadas como puladas (não há como consultar sem token).
 */
export async function runPreflight(options: PreflightOptions): Promise<PreflightReport> {
  const { config } = options;
  const tokens = new TokenManager({
    config,
    fetchImpl: options.fetchImpl,
    clock: options.clock,
  });
  const client = new SankhyaClient({
    config,
    fetchImpl: options.fetchImpl,
    tokenManager: tokens,
  });

  const checks = options.sampleChecks ?? DEFAULT_SAMPLE_CHECKS;
  const auth = await checkAuth(tokens);

  let data: PreflightDataCheck[];
  if (auth.ok) {
    data = await Promise.all(checks.map((spec) => checkData(client, spec)));
  } else {
    data = checks.map((spec) => ({
      entity: spec.entity,
      label: spec.label,
      ok: false,
      count: 0,
      hasMoreResult: false,
      skipped: true,
    }));
  }

  const ok = auth.ok && data.every((d) => d.ok);
  return { env: config.env, baseUrl: config.baseUrl, auth, data, ok };
}

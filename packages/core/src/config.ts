/**
 * Configuração derivada de variáveis de ambiente.
 *
 * As credenciais vêm SOMENTE do ambiente do servidor e são registradas como
 * segredos para redação. Nada aqui é exposto ao LLM.
 */
import { SankhyaConfigError } from './errors.js';
import { registerSecret } from './redact.js';
import type { SankhyaEnv } from './types.js';

/** Base URLs oficiais por ambiente. */
const BASE_URLS: Record<SankhyaEnv, string> = {
  production: 'https://api.sankhya.com.br',
  sandbox: 'https://api.sandbox.sankhya.com.br',
};

/** Configuração de credenciais/ambiente para o cliente HTTP. */
export interface SankhyaConfig {
  clientId: string;
  clientSecret: string;
  xToken: string;
  env: SankhyaEnv;
  /** Base URL final (derivada de `env`, ou sobrescrita por SANKHYA_BASE_URL). */
  baseUrl: string;
  /** Folga em segundos para renovar o token antes de expirar. Default 60. */
  tokenRefreshSkewSeconds: number;
  /** Timeout de requisições HTTP em ms. Default 30000. */
  httpTimeoutMs: number;
}

/** Opções de política de segurança do servidor (independentes de credenciais). */
export interface ServerSecurityOptions {
  /** Bloqueia qualquer operação de escrita. */
  readOnly: boolean;
  /** Operações de escrita apenas exibem o payload (não executam). */
  dryRun: boolean;
  /** Habilita a tool perigosa de SQL livre. */
  allowRawSql: boolean;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(value.trim().toLowerCase());
}

function parseEnv(value: string | undefined): SankhyaEnv {
  const v = (value ?? 'sandbox').trim().toLowerCase();
  if (v === 'production' || v === 'prod') return 'production';
  if (v === 'sandbox' || v === 'sand' || v === '') return 'sandbox';
  throw new SankhyaConfigError(
    `SANKHYA_ENV inválido: "${value}". Use "sandbox" (default) ou "production".`,
  );
}

/**
 * Lê e valida a configuração a partir de `process.env` (ou um objeto fornecido,
 * útil em testes). Lança `SankhyaConfigError` se faltarem credenciais.
 *
 * Default de ambiente = **sandbox** (segurança). Produção exige opt-in explícito
 * via `SANKHYA_ENV=production`.
 */
export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SankhyaConfig {
  const clientId = env.SANKHYA_CLIENT_ID?.trim();
  const clientSecret = env.SANKHYA_CLIENT_SECRET?.trim();
  const xToken = env.SANKHYA_X_TOKEN?.trim();

  const missing: string[] = [];
  if (!clientId) missing.push('SANKHYA_CLIENT_ID');
  if (!clientSecret) missing.push('SANKHYA_CLIENT_SECRET');
  if (!xToken) missing.push('SANKHYA_X_TOKEN');
  if (missing.length > 0) {
    throw new SankhyaConfigError(
      `Credenciais ausentes: ${missing.join(', ')}. Defina-as no ambiente do servidor.`,
    );
  }

  // Registra segredos para redação imediata.
  registerSecret(clientId);
  registerSecret(clientSecret);
  registerSecret(xToken);

  const sankhyaEnv = parseEnv(env.SANKHYA_ENV);
  const baseUrl = (env.SANKHYA_BASE_URL?.trim() || BASE_URLS[sankhyaEnv]).replace(/\/+$/, '');

  const tokenRefreshSkewSeconds = Number.parseInt(env.SANKHYA_TOKEN_REFRESH_SKEW ?? '', 10);
  const httpTimeoutMs = Number.parseInt(env.SANKHYA_HTTP_TIMEOUT ?? '', 10);

  return {
    // `!` seguro: validamos `missing` acima.
    clientId: clientId!,
    clientSecret: clientSecret!,
    xToken: xToken!,
    env: sankhyaEnv,
    baseUrl,
    tokenRefreshSkewSeconds: Number.isFinite(tokenRefreshSkewSeconds)
      ? tokenRefreshSkewSeconds
      : 60,
    httpTimeoutMs: Number.isFinite(httpTimeoutMs) ? httpTimeoutMs : 30_000,
  };
}

/** Lê as opções de segurança do servidor a partir do ambiente. */
export function loadSecurityOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ServerSecurityOptions {
  return {
    readOnly: parseBool(env.SANKHYA_READ_ONLY, false),
    dryRun: parseBool(env.SANKHYA_DRY_RUN, false),
    allowRawSql: parseBool(env.SANKHYA_ALLOW_RAW_SQL, false),
  };
}

/** Base URL para um ambiente (exposto para diagnóstico/testes). */
export function baseUrlForEnv(env: SankhyaEnv): string {
  return BASE_URLS[env];
}

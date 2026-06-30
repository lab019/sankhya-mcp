/**
 * @sankhya-mcp/core — API pública do núcleo compartilhado.
 */
export * from './types.js';
export * from './errors.js';
export * from './config.js';
export * from './redact.js';
export * from './http.js';
export * from './auth.js';
export * from './payloads.js';
export * from './client.js';
export * from './preflight.js';

import {
  loadConfigFromEnv,
  loadSecurityOptionsFromEnv,
  type ServerSecurityOptions,
} from './config.js';
import { SankhyaClient } from './client.js';

/** Cliente + opções de segurança prontos a partir do ambiente. */
export interface SankhyaRuntime {
  client: SankhyaClient;
  security: ServerSecurityOptions;
}

/**
 * Atalho de conveniência para servidores: lê env vars, valida credenciais,
 * aplica o default sandbox e devolve um `SankhyaClient` já configurado junto das
 * opções de segurança (read-only, dry-run, SQL livre).
 */
export function createRuntimeFromEnv(env: NodeJS.ProcessEnv = process.env): SankhyaRuntime {
  const config = loadConfigFromEnv(env);
  const security = loadSecurityOptionsFromEnv(env);
  const client = new SankhyaClient({ config, allowRawSql: security.allowRawSql });
  return { client, security };
}

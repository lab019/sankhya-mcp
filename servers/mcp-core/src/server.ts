/**
 * Montagem do servidor MCP de referência.
 *
 * Cria o `McpServer`, injeta as dependências (client + política + dicionário) e
 * registra tools e resources. Serve de molde para os demais servidores de domínio.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defaultRegistry, type EntityRegistry } from '@sankhya-mcp/data-dictionary';
import type { SankhyaRuntime } from '@sankhya-mcp/core';
import type { ServerDeps } from './deps.js';
import { registerQueryEntity } from './tools/query-entity.js';
import { registerLoadRecord } from './tools/load-record.js';
import { registerSaveRecord } from './tools/save-record.js';
import { registerExecuteQuery } from './tools/execute-query.js';
import { registerEntityResources } from './resources/entities.js';

export interface CreateServerOptions {
  runtime: SankhyaRuntime;
  /** Dicionário de dados. Default: registro padrão pré-carregado. */
  registry?: EntityRegistry;
  name?: string;
  version?: string;
}

export function createServer(options: CreateServerOptions): McpServer {
  const deps: ServerDeps = {
    client: options.runtime.client,
    security: options.runtime.security,
    registry: options.registry ?? defaultRegistry,
  };

  const server = new McpServer({
    name: options.name ?? 'sankhya-mcp-core',
    version: options.version ?? '0.1.0',
  });

  // Tools genéricas.
  registerQueryEntity(server, deps);
  registerLoadRecord(server, deps);
  registerSaveRecord(server, deps);
  // Tool perigosa: registrada apenas se SANKHYA_ALLOW_RAW_SQL=true.
  registerExecuteQuery(server, deps);

  // Resources de descoberta de schema.
  registerEntityResources(server, deps);

  return server;
}

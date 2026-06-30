/**
 * Dependências injetadas nas tools/resources do servidor.
 */
import type { SankhyaClient, ServerSecurityOptions } from '@sankhya-mcp/core';
import type { EntityRegistry } from '@sankhya-mcp/data-dictionary';

export interface ServerDeps {
  client: SankhyaClient;
  security: ServerSecurityOptions;
  registry: EntityRegistry;
}

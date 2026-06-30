#!/usr/bin/env node
/**
 * Entrypoint executável do servidor MCP Core (transporte stdio).
 *
 * Lê credenciais e política das variáveis de ambiente (default sandbox),
 * monta o servidor e o conecta ao transporte stdio.
 *
 * IMPORTANTE: este servidor fala MCP por stdout. Diagnósticos vão SEMPRE para
 * stderr — nunca escreva logs em stdout, ou o protocolo é corrompido. E nunca
 * logue segredos.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createRuntimeFromEnv, SankhyaConfigError } from '@sankhya-mcp/core';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const runtime = createRuntimeFromEnv();

  // Aviso visível (stderr) quando rodando em produção.
  if (runtime.client.config.env === 'production') {
    process.stderr.write('[sankhya-mcp-core] ATENÇÃO: conectado ao ambiente de PRODUÇÃO.\n');
  }
  if (runtime.security.readOnly) {
    process.stderr.write('[sankhya-mcp-core] Modo READ-ONLY ativo.\n');
  }
  if (runtime.security.dryRun) {
    process.stderr.write('[sankhya-mcp-core] Modo DRY-RUN ativo (escritas não são enviadas).\n');
  }
  if (runtime.security.allowRawSql) {
    process.stderr.write('[sankhya-mcp-core] ATENÇÃO: SQL livre HABILITADO (execute_query).\n');
  }

  const server = createServer({ runtime });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `[sankhya-mcp-core] Servidor iniciado (env=${runtime.client.config.env}).\n`,
  );
}

main().catch((err: unknown) => {
  if (err instanceof SankhyaConfigError) {
    process.stderr.write(`[sankhya-mcp-core] Erro de configuração: ${err.message}\n`);
  } else {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[sankhya-mcp-core] Falha ao iniciar: ${message}\n`);
  }
  process.exit(1);
});

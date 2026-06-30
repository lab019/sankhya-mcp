/**
 * Tool `execute_query` — SQL livre (DbExplorerSP.executeQuery).
 *
 * PERIGOSO. Só é registrada quando `SANKHYA_ALLOW_RAW_SQL=true`. Mesmo assim, o
 * client aplica a mesma checagem de política como defesa em profundidade.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerDeps } from '../deps.js';
import { executeQueryShape } from '../schemas.js';
import { errorResult, jsonResult } from '../result.js';

export function registerExecuteQuery(server: McpServer, deps: ServerDeps): void {
  // Defesa: não registra a tool se o SQL livre não estiver habilitado.
  if (!deps.security.allowRawSql) return;

  server.registerTool(
    'execute_query',
    {
      title: '⚠️ Executar SQL livre (perigoso)',
      description:
        'Executa SQL arbitrário via DbExplorerSP.executeQuery. PERIGOSO: acesso direto ao banco, ' +
        'sem as validações de negócio do ERP. Habilitado apenas com SANKHYA_ALLOW_RAW_SQL=true. ' +
        'Em modo read-only, prefira consultas SELECT.',
      inputSchema: executeQueryShape,
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const envelope = await deps.client.executeQuery(args.sql, args.module);
        return jsonResult({ result: envelope });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}

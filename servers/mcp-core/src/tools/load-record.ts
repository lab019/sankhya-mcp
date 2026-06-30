/**
 * Tool `load_record` — carrega um único registro pela chave primária.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerDeps } from '../deps.js';
import { loadRecordShape } from '../schemas.js';
import { errorResult, jsonResult, textResult } from '../result.js';

export function registerLoadRecord(server: McpServer, deps: ServerDeps): void {
  server.registerTool(
    'load_record',
    {
      title: 'Carregar registro único',
      description:
        'Carrega um único registro de uma entidade pela chave primária. ' +
        'Retorna o registro como objeto campo→valor, ou indica que não foi encontrado.',
      inputSchema: loadRecordShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const record = await deps.client.loadRecord({
          entity: args.entity,
          key: args.key,
          fields: args.fields,
          module: args.module,
        });
        if (!record) {
          return textResult(
            `Nenhum registro encontrado em "${args.entity}" para a chave informada.`,
          );
        }
        return jsonResult({ record });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}

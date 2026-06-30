/**
 * Tool `query_entity` — consulta múltipla genérica (loadRecords).
 *
 * Uma única tool cobre centenas de endpoints de leitura: a entidade é um
 * parâmetro, não uma tool dedicada.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerDeps } from '../deps.js';
import { queryEntityShape } from '../schemas.js';
import { errorResult, jsonResult } from '../result.js';

export function registerQueryEntity(server: McpServer, deps: ServerDeps): void {
  server.registerTool(
    'query_entity',
    {
      title: 'Consultar entidade (loadRecords)',
      description:
        'Consulta registros de qualquer entidade Sankhya via CRUDServiceProvider.loadRecords. ' +
        'A entidade e os campos são parâmetros. Suporta filtro com parâmetros tipados e paginação. ' +
        'Descubra entidades/campos nos resources sankhya://entities.',
      inputSchema: queryEntityShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const result = await deps.client.loadRecords({
          entity: args.entity,
          fields: args.fields,
          criteria: args.criteria,
          offsetPage: args.offsetPage,
          includePresentationFields: args.includePresentationFields,
          module: args.module,
        });
        return jsonResult({
          records: result.records,
          count: result.records.length,
          offsetPage: result.offsetPage,
          hasMoreResult: result.hasMoreResult,
          // Dica de paginação para o agente.
          nextOffsetPage: result.hasMoreResult ? result.offsetPage + 1 : null,
        });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}

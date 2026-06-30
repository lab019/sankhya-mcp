/**
 * Tool `save_record` — upsert genérico (saveRecord).
 *
 * Camadas de segurança:
 * - read-only global: bloqueia totalmente a escrita;
 * - dry-run (global via env OU por chamada): mostra o payload que SERIA enviado,
 *   sem executar.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SankhyaPolicyError } from '@sankhya-mcp/core';
import type { ServerDeps } from '../deps.js';
import { saveRecordShape } from '../schemas.js';
import { errorResult, jsonResult } from '../result.js';

export function registerSaveRecord(server: McpServer, deps: ServerDeps): void {
  server.registerTool(
    'save_record',
    {
      title: 'Salvar registro (upsert)',
      description:
        'Insere ou atualiza um registro via CRUDServiceProvider.saveRecord. ' +
        'Se a chave primária for informada e existir → UPDATE; caso contrário → INSERT. ' +
        'Respeita o modo read-only global e suporta dry-run (mostra o payload sem enviar).',
      inputSchema: saveRecordShape,
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        if (deps.security.readOnly) {
          throw new SankhyaPolicyError(
            'Servidor em modo READ-ONLY: operações de escrita estão desabilitadas (SANKHYA_READ_ONLY=true).',
          );
        }

        const input = {
          entity: args.entity,
          values: args.values,
          key: args.key,
          module: args.module,
        };

        const effectiveDryRun = deps.security.dryRun || args.dryRun === true;
        if (effectiveDryRun) {
          // Constrói o payload mas NÃO envia.
          const request = deps.client.buildSaveRecordRequest(input);
          return jsonResult({
            dryRun: true,
            reason: deps.security.dryRun ? 'SANKHYA_DRY_RUN=true' : 'dryRun=true na chamada',
            operation: args.key ? 'UPDATE (se a PK existir) ou INSERT' : 'INSERT',
            wouldSend: request,
          });
        }

        const envelope = await deps.client.saveRecord(input);
        return jsonResult({ dryRun: false, result: envelope });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}

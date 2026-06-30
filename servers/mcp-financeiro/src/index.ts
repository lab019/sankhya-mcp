#!/usr/bin/env node
/**
 * Servidor MCP do domínio Financeiro.
 *
 * ESQUELETO: consome @sankhya-mcp/core e expõe UMA tool de exemplo funcional
 * (`financeiro_query_entity`). Preencha com as tools de negócio do domínio.
 *
 * Roadmap de tools de negócio a implementar:
 *   - baixar_titulo — baixa de título financeiro
 *   - incluir_titulo — contas a pagar/receber
 *   - conciliar_conta
 *   - consultar_extrato
 *
 * Entidades típicas deste domínio:
 *   - Natureza (TGFNAT)
 *   - Financeiro / títulos (TGFFIN) — TODO confirmar PK na doc
 *
 * Convenção: não inventar campos/endpoints. Para detalhes, consulte
 * https://developer.sankhya.com.br/reference/ e registre mapeamentos no
 * pacote @sankhya-mcp/data-dictionary.
 *
 * Diagnósticos vão SEMPRE para stderr (stdout é reservado ao protocolo MCP).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createRuntimeFromEnv, redact, SankhyaConfigError, SankhyaError } from '@sankhya-mcp/core';
import { z } from 'zod';

const DEFAULT_MODULE = 'mge';

async function main() {
  const runtime = createRuntimeFromEnv();
  const server = new McpServer({ name: 'sankhya-mcp-financeiro', version: '0.1.0' });

  // --- Tool de exemplo (funcional): consulta genérica escopada ao domínio. ---
  server.registerTool(
    'financeiro_query_entity',
    {
      title: '[Financeiro] Consultar entidade',
      description:
        'Exemplo funcional: consulta entidades do domínio Financeiro via loadRecords. ' +
        'Entidades típicas: Natureza (TGFNAT), Financeiro / títulos (TGFFIN) — TODO confirmar PK na doc. ' +
        'Substitua/expanda com as tools de negócio do domínio.',
      inputSchema: {
        entity: z.string().describe('Entidade (ex.: "Natureza").'),
        fields: z.array(z.string()).min(1).describe('Campos a retornar.'),
        expression: z.string().optional().describe('Filtro SQL-like com "?" (opcional).'),
        params: z.array(z.string()).optional().describe('Parâmetros do filtro, na ordem dos "?".'),
        offsetPage: z.number().int().min(0).optional().describe('Página (base 0).'),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const result = await runtime.client.loadRecords({
          entity: args.entity,
          fields: args.fields,
          criteria: args.expression
            ? {
                expression: args.expression,
                parameters: (args.params ?? []).map((value) => ({ value })),
              }
            : undefined,
          offsetPage: args.offsetPage,
          module: DEFAULT_MODULE,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                redact({
                  records: result.records,
                  count: result.records.length,
                  hasMoreResult: result.hasMoreResult,
                  nextOffsetPage: result.hasMoreResult ? result.offsetPage + 1 : null,
                }),
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof SankhyaError ? `[${err.code}] ${err.message}` : String(err);
        return { content: [{ type: 'text', text: message }], isError: true };
      }
    },
  );

  // TODO: registrar aqui as tools de negócio do domínio Financeiro.

  if (runtime.client.config.env === 'production') {
    process.stderr.write('[sankhya-mcp-financeiro] ATENÇÃO: conectado ao ambiente de PRODUÇÃO.\n');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `[sankhya-mcp-financeiro] Servidor iniciado (env=${runtime.client.config.env}).\n`,
  );
}

main().catch((err) => {
  if (err instanceof SankhyaConfigError) {
    process.stderr.write(`[sankhya-mcp-financeiro] Erro de configuração: ${err.message}\n`);
  } else {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[sankhya-mcp-financeiro] Falha ao iniciar: ${message}\n`);
  }
  process.exit(1);
});

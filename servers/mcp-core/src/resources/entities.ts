/**
 * Resources de descoberta de schema (dicionário de dados).
 *
 * - `sankhya://entities` → lista de entidades conhecidas (entidade↔tabela, PK).
 * - `sankhya://entities/{entity}/fields` → campos conhecidos de uma entidade.
 *
 * Em vez de explodir o schema em centenas de tools, expomos o dicionário como
 * resources que o agente consulta sob demanda.
 */
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerDeps } from '../deps.js';

export function registerEntityResources(server: McpServer, deps: ServerDeps): void {
  // Lista geral de entidades.
  server.registerResource(
    'entities',
    'sankhya://entities',
    {
      title: 'Entidades Sankhya',
      description:
        'Lista de entidades conhecidas com mapeamento tabela↔entidade e chave primária. ' +
        'Lista parcial e extensível pela comunidade.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const entities = deps.registry.list().map((e) => ({
        entity: e.entity,
        table: e.table,
        module: e.module,
        primaryKey: e.primaryKey,
        description: e.description,
        fieldsComplete: e.fieldsComplete ?? false,
        docUrl: e.docUrl,
      }));
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                note:
                  'Lista PARCIAL de entidades. Muitos serviços/entidades nativos não estão ' +
                  'documentados e podem ser registrados pela comunidade. Consulte docUrl.',
                count: entities.length,
                entities,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Campos de uma entidade específica.
  server.registerResource(
    'entity-fields',
    new ResourceTemplate('sankhya://entities/{entity}/fields', { list: undefined }),
    {
      title: 'Campos de uma entidade',
      description:
        'Campos conhecidos de uma entidade (lista parcial). Para o conjunto completo, ' +
        'consulte a documentação oficial indicada em docUrl.',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const entityName = Array.isArray(variables.entity) ? variables.entity[0] : variables.entity;
      const def = entityName ? deps.registry.get(entityName) : undefined;

      if (!def) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(
                {
                  error: `Entidade "${entityName ?? ''}" não está no dicionário.`,
                  hint: 'Veja sankhya://entities para a lista de entidades conhecidas.',
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                entity: def.entity,
                table: def.table,
                primaryKey: def.primaryKey,
                fieldsComplete: def.fieldsComplete ?? false,
                fields: def.fields ?? [],
                docUrl: def.docUrl,
                note: def.fieldsComplete
                  ? undefined
                  : 'Lista de campos PARCIAL. Não assuma que campos ausentes não existem; consulte docUrl.',
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}

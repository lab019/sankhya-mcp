/**
 * Schemas zod compartilhados pelas tools.
 *
 * NOTA: `registerTool` recebe um "raw shape" (objeto de campos zod), por isso
 * exportamos os shapes como objetos, não como `z.object(...)`.
 */
import { z } from 'zod';

/** Parâmetro tipado de critério (corresponde a um `?` na expressão). */
export const parameterSchema = z.object({
  value: z
    .union([z.string(), z.number(), z.boolean()])
    .describe('Valor do parâmetro, na ordem dos "?" da expressão.'),
  type: z
    .enum(['I', 'S', 'D', 'T', 'F'])
    .optional()
    .describe(
      'Tipo do parâmetro (I=inteiro, S=string, D=data, T=timestamp, F=decimal). Inferido se omitido.',
    ),
});

export const criteriaSchema = z.object({
  expression: z
    .string()
    .describe('Expressão SQL-like com placeholders "?" (ex.: "this.CODPROD = ?").'),
  parameters: z.array(parameterSchema).optional().describe('Parâmetros, na ordem dos "?".'),
});

/** Shape de input da tool query_entity (loadRecords). */
export const queryEntityShape = {
  entity: z
    .string()
    .describe('Nome da entidade (ex.: "Produto"). Descubra entidades em sankhya://entities.'),
  fields: z
    .array(z.string())
    .min(1)
    .describe(
      'Campos a retornar. Suporta campos de entidades ligadas via path (ex.: "parceiro.NOMEPARC").',
    ),
  criteria: criteriaSchema.optional().describe('Filtro opcional (cláusula WHERE com "?").'),
  offsetPage: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Página (base 0) para paginação. Use hasMoreResult da resposta para iterar.'),
  includePresentationFields: z
    .boolean()
    .optional()
    .describe('Inclui campos de apresentação (formatados). Default false.'),
  module: z.string().optional().describe('Módulo do gateway: "mge" (default) ou "mgecom".'),
};

/** Shape de input da tool load_record. */
export const loadRecordShape = {
  entity: z.string().describe('Nome da entidade (ex.: "Produto").'),
  key: z
    .record(z.union([z.string(), z.number()]))
    .describe('Chave primária como pares campo→valor (ex.: { "CODPROD": 123 }).'),
  fields: z
    .array(z.string())
    .optional()
    .describe('Campos a retornar. Se omitido, retorna ao menos as chaves.'),
  module: z.string().optional().describe('Módulo do gateway. Default "mge".'),
};

/** Shape de input da tool save_record (upsert). */
export const saveRecordShape = {
  entity: z.string().describe('Nome da entidade (ex.: "Produto").'),
  values: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .describe('Campos a gravar (sem a PK). null limpa o campo.'),
  key: z
    .record(z.union([z.string(), z.number()]))
    .optional()
    .describe('PK para UPDATE. Se existir no banco → UPDATE; se omitida → INSERT.'),
  module: z.string().optional().describe('Módulo do gateway. Default "mge".'),
  dryRun: z
    .boolean()
    .optional()
    .describe('Se true, apenas mostra o payload que SERIA enviado, sem executar.'),
};

/** Shape de input da tool execute_query (SQL livre, perigoso). */
export const executeQueryShape = {
  sql: z.string().describe('Consulta SQL a executar. PERIGOSO: acesso direto ao banco.'),
  module: z.string().optional().describe('Módulo do gateway. Default "mge".'),
};

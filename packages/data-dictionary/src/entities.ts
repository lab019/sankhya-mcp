/**
 * Seed do dicionário de dados.
 *
 * IMPORTANTE (convenção do projeto): não inventar nomes de campos. As entidades
 * abaixo trazem apenas mapeamentos tabela↔entidade e chaves primárias amplamente
 * documentados, mais um punhado de campos realmente padrão. Para o restante,
 * cada definição aponta `docUrl` para a documentação oficial e marca
 * `fieldsComplete: false`.
 *
 * A comunidade pode (e deve) registrar novas entidades em runtime via
 * `registerEntity()` — muitos serviços/entidades nativos do ERP não estão na doc
 * pública e são descobertos via DevTools.
 */
import type { EntityDefinition } from './types.js';

const REF = 'https://developer.sankhya.com.br/reference';

export const SEED_ENTITIES: EntityDefinition[] = [
  {
    entity: 'Produto',
    table: 'TGFPRO',
    module: 'mge',
    primaryKey: ['CODPROD'],
    description: 'Cadastro de produtos.',
    fields: [
      { name: 'CODPROD', label: 'Código do produto', type: 'integer' },
      { name: 'DESCRPROD', label: 'Descrição do produto', type: 'string' },
      { name: 'ATIVO', label: 'Ativo (S/N)', type: 'string' },
    ],
    fieldsComplete: false,
    docUrl: `${REF}/produtos`,
  },
  {
    entity: 'Parceiro',
    table: 'TGFPAR',
    module: 'mge',
    primaryKey: ['CODPARC'],
    description: 'Cadastro de parceiros (clientes, fornecedores, transportadoras, etc.).',
    fields: [
      { name: 'CODPARC', label: 'Código do parceiro', type: 'integer' },
      { name: 'NOMEPARC', label: 'Nome/Razão social', type: 'string' },
      { name: 'CGC_CPF', label: 'CNPJ/CPF', type: 'string' },
      { name: 'ATIVO', label: 'Ativo (S/N)', type: 'string' },
    ],
    fieldsComplete: false,
    docUrl: `${REF}/parceiros`,
  },
  {
    entity: 'CabecalhoNota',
    table: 'TGFCAB',
    module: 'mgecom',
    primaryKey: ['NUNOTA'],
    description: 'Cabeçalho de notas/pedidos (movimentações comerciais).',
    fields: [
      { name: 'NUNOTA', label: 'Número único da nota', type: 'integer' },
      { name: 'NUMNOTA', label: 'Número da nota', type: 'integer' },
      { name: 'CODPARC', label: 'Parceiro', type: 'integer' },
      { name: 'CODTIPOPER', label: 'Tipo de operação (TOP)', type: 'integer' },
    ],
    fieldsComplete: false,
    // TODO: confirmar endpoint exato na doc de pedidos/notas.
    docUrl: `${REF}`,
  },
  {
    entity: 'ItemNota',
    table: 'TGFITE',
    module: 'mgecom',
    primaryKey: ['NUNOTA', 'SEQUENCIA'],
    description: 'Itens das notas/pedidos.',
    fields: [
      { name: 'NUNOTA', label: 'Número único da nota', type: 'integer' },
      { name: 'SEQUENCIA', label: 'Sequência do item', type: 'integer' },
      { name: 'CODPROD', label: 'Produto', type: 'integer' },
      { name: 'QTDNEG', label: 'Quantidade negociada', type: 'decimal' },
    ],
    fieldsComplete: false,
    docUrl: `${REF}`,
  },
  {
    entity: 'Natureza',
    table: 'TGFNAT',
    module: 'mge',
    primaryKey: ['CODNAT'],
    description: 'Naturezas de receita/despesa (financeiro/contábil).',
    fields: [
      { name: 'CODNAT', label: 'Código da natureza', type: 'integer' },
      { name: 'DESCRNAT', label: 'Descrição', type: 'string' },
    ],
    fieldsComplete: false,
    docUrl: `${REF}/naturezas`,
  },
];

/**
 * Tipos compartilhados do núcleo Sankhya.
 *
 * NOTA: A API Sankhya usa uma convenção de JSON peculiar onde valores escalares
 * são embrulhados em `{ "$": "valor" }`. Os helpers em `payloads.ts` cuidam dessa
 * conversão para que o resto do código trabalhe com objetos JS normais.
 */

/** Ambientes oficiais da API Sankhya. Default do projeto = sandbox. */
export type SankhyaEnv = 'production' | 'sandbox';

/**
 * Módulos do Gateway. Serviços são EXCLUSIVOS de cada módulo:
 * - `mge`: cadastros e dados gerais (CRUDServiceProvider, DbExplorerSP, ...).
 * - `mgecom`: movimentações comerciais (CACSP.IncluirNota, SelecaoDocumentoSP.faturar, ...).
 *
 * Outros módulos existem na plataforma; este union é aberto via `(string & {})`
 * para permitir que a comunidade registre novos módulos sem alterar o core.
 */
export type SankhyaModule = 'mge' | 'mgecom' | (string & {});

/**
 * Tipos de parâmetro aceitos em `criteria.parameter[].type`.
 * Baseado na convenção da API (I=inteiro, S=string, etc.).
 * TODO: confirmar a lista completa na doc de loadRecords.
 * https://developer.sankhya.com.br/reference/loadrecords
 */
export type SankhyaParamType = 'I' | 'S' | 'D' | 'T' | 'F';

/** Um parâmetro tipado de critério. */
export interface CriteriaParameter {
  /** Valor a ser interpolado no `?` da expressão. */
  value: string | number | boolean;
  /** Tipo declarado para a API (default inferido em `payloads.ts`). */
  type?: SankhyaParamType;
}

/** Critério de filtro para loadRecords (cláusula WHERE com placeholders `?`). */
export interface QueryCriteria {
  /** Expressão SQL-like com placeholders `?` (ex.: `this.CODPROD = ?`). */
  expression: string;
  /** Parâmetros tipados, na ordem dos `?`. */
  parameters?: CriteriaParameter[];
}

/** Entrada normalizada para uma consulta múltipla (loadRecords). */
export interface LoadRecordsInput {
  /** Entidade (mapeia uma tabela; ex.: `Produto` → TGFPRO). */
  entity: string;
  /** Campos a retornar. Aceita campos de entidades ligadas via `path` (ex.: `parceiro.NOMEPARC`). */
  fields: string[];
  /** Filtro opcional. */
  criteria?: QueryCriteria;
  /** Página (base 0) para paginação. */
  offsetPage?: number;
  /** Inclui campos de apresentação (formatados). Default "N". */
  includePresentationFields?: boolean;
  /** Módulo do gateway. Default "mge". */
  module?: SankhyaModule;
}

/** Entrada para carregar um único registro pela chave primária (loadRecord). */
export interface LoadRecordInput {
  entity: string;
  /** Pares campo→valor que compõem a PK (ex.: `{ CODPROD: 123 }`). */
  key: Record<string, string | number>;
  fields?: string[];
  module?: SankhyaModule;
}

/** Entrada para upsert de um registro (saveRecord). */
export interface SaveRecordInput {
  entity: string;
  /** Campos a gravar (sem a PK). */
  values: Record<string, string | number | boolean | null>;
  /**
   * Chave primária. Se informada e existente no banco → UPDATE; caso contrário → INSERT.
   * Omitir para forçar INSERT de um novo registro com PK auto-gerada.
   */
  key?: Record<string, string | number>;
  module?: SankhyaModule;
}

/** Resultado normalizado de uma consulta múltipla. */
export interface LoadRecordsResult {
  /** Registros como objetos campo→valor. */
  records: Array<Record<string, unknown>>;
  /** Indica se há mais páginas além da atual. */
  hasMoreResult: boolean;
  /** Página consultada (base 0). */
  offsetPage: number;
  /** Resposta crua da API (para depuração/uso avançado). */
  raw: unknown;
}

/** Resposta padrão de um serviço do Gateway, antes de normalizar. */
export interface ServiceEnvelope {
  serviceName?: string;
  /** "1" = sucesso; demais = erro. */
  status?: string;
  statusMessage?: string;
  responseBody?: unknown;
  [key: string]: unknown;
}

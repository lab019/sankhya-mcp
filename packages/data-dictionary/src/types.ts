/** Tipos do dicionário de dados. */

/** Um campo de uma entidade. */
export interface EntityField {
  /** Nome do campo na entidade/tabela (ex.: `CODPROD`). */
  name: string;
  /** Rótulo legível. */
  label?: string;
  /**
   * Tipo lógico do campo. Mantido como string aberta porque o mapeamento exato
   * de tipos da Sankhya deve ser confirmado na doc.
   * TODO: padronizar com base no dicionário oficial.
   */
  type?: string;
  /** Descrição/observações. */
  description?: string;
}

/** Definição de uma entidade e seu mapeamento para a tabela física. */
export interface EntityDefinition {
  /** Nome da entidade usado nos serviços CRUD (ex.: `Produto`). */
  entity: string;
  /** Tabela física correspondente (ex.: `TGFPRO`). */
  table: string;
  /** Módulo do gateway onde a entidade é mais comum (`mge`/`mgecom`). */
  module?: string;
  /** Campos que compõem a chave primária. */
  primaryKey: string[];
  /** Descrição funcional. */
  description?: string;
  /**
   * Campos conhecidos. ATENÇÃO: lista propositalmente PARCIAL — contém apenas
   * campos amplamente usados e confirmados. Consulte `docUrl` para a lista
   * completa; não assuma que campos ausentes não existem.
   */
  fields?: EntityField[];
  /** Indica se `fields` cobre todos os campos da entidade (quase sempre `false`). */
  fieldsComplete?: boolean;
  /** Link para a documentação oficial da entidade/serviço. */
  docUrl?: string;
}

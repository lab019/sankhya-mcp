/**
 * Registro de entidades extensível em runtime.
 *
 * Permite que servidores e a comunidade adicionem mapeamentos sem alterar o
 * pacote — essencial porque muitos serviços/entidades nativos não estão na doc
 * pública e são descobertos via DevTools.
 */
import { SEED_ENTITIES } from './entities.js';
import type { EntityDefinition } from './types.js';

/** Normaliza o nome da entidade para busca case-insensitive. */
function normalize(entity: string): string {
  return entity.trim().toLowerCase();
}

export class EntityRegistry {
  private readonly byEntity = new Map<string, EntityDefinition>();
  private readonly byTable = new Map<string, EntityDefinition>();

  constructor(seed: EntityDefinition[] = []) {
    for (const def of seed) this.register(def);
  }

  /** Registra (ou substitui) uma definição de entidade. */
  register(def: EntityDefinition): void {
    this.byEntity.set(normalize(def.entity), def);
    this.byTable.set(normalize(def.table), def);
  }

  /** Registra várias de uma vez. */
  registerMany(defs: EntityDefinition[]): void {
    for (const def of defs) this.register(def);
  }

  /** Busca por nome de entidade (case-insensitive). */
  get(entity: string): EntityDefinition | undefined {
    return this.byEntity.get(normalize(entity));
  }

  /** Busca por nome de tabela física (case-insensitive). */
  getByTable(table: string): EntityDefinition | undefined {
    return this.byTable.get(normalize(table));
  }

  /** Lista todas as definições conhecidas. */
  list(): EntityDefinition[] {
    return [...this.byEntity.values()];
  }

  /** Verdadeiro se a entidade está registrada. */
  has(entity: string): boolean {
    return this.byEntity.has(normalize(entity));
  }
}

/**
 * Registro padrão pré-carregado com as entidades seed. Servidores podem importar
 * e estender este singleton, ou criar instâncias próprias com `new EntityRegistry`.
 */
export const defaultRegistry = new EntityRegistry(SEED_ENTITIES);

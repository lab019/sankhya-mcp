import { describe, it, expect } from 'vitest';
import { EntityRegistry, defaultRegistry } from '../src/registry.js';

describe('EntityRegistry', () => {
  it('vem pré-carregado com as entidades seed', () => {
    expect(defaultRegistry.has('Produto')).toBe(true);
    expect(defaultRegistry.get('produto')?.table).toBe('TGFPRO'); // case-insensitive
    expect(defaultRegistry.getByTable('TGFPAR')?.entity).toBe('Parceiro');
  });

  it('marca listas de campos como incompletas (não inventar campos)', () => {
    for (const def of defaultRegistry.list()) {
      expect(def.fieldsComplete).toBe(false);
      expect(def.primaryKey.length).toBeGreaterThan(0);
    }
  });

  it('permite registrar novas entidades em runtime', () => {
    const reg = new EntityRegistry();
    expect(reg.has('Foo')).toBe(false);
    reg.register({ entity: 'Foo', table: 'TGFFOO', primaryKey: ['CODFOO'] });
    expect(reg.get('foo')?.table).toBe('TGFFOO');
    expect(reg.getByTable('tgffoo')?.entity).toBe('Foo');
  });

  it('substitui definição existente ao registrar de novo', () => {
    const reg = new EntityRegistry();
    reg.register({ entity: 'X', table: 'T1', primaryKey: ['A'] });
    reg.register({ entity: 'X', table: 'T2', primaryKey: ['A'] });
    expect(reg.get('X')?.table).toBe('T2');
  });
});

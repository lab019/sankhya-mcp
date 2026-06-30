import { describe, it, expect } from 'vitest';
import {
  buildLoadRecordsPayload,
  buildSaveRecordPayload,
  parseLoadRecordsResult,
  unwrapValue,
  inferParamType,
  wrapScalar,
  SERVICE_LOAD_RECORDS,
  SERVICE_SAVE_RECORD,
} from '../src/payloads.js';

describe('wrapScalar / inferParamType', () => {
  it('embrulha escalares em { $ }', () => {
    expect(wrapScalar(123)).toEqual({ $: '123' });
    expect(wrapScalar('abc')).toEqual({ $: 'abc' });
    expect(wrapScalar(true)).toEqual({ $: 'true' });
  });

  it('infere tipos de parâmetro', () => {
    expect(inferParamType(10)).toBe('I');
    expect(inferParamType(10.5)).toBe('F');
    expect(inferParamType('x')).toBe('S');
  });
});

describe('buildLoadRecordsPayload', () => {
  it('monta o dataSet com fieldset, offsetPage e includePresentationFields', () => {
    const req = buildLoadRecordsPayload({
      entity: 'Produto',
      fields: ['CODPROD', 'DESCRPROD'],
      offsetPage: 2,
    });
    expect(req.serviceName).toBe(SERVICE_LOAD_RECORDS);
    const ds = (req.requestBody as any).dataSet;
    expect(ds.rootEntity).toBe('Produto');
    expect(ds.includePresentationFields).toBe('N');
    expect(ds.offsetPage).toBe('2');
    expect(ds.entity.fieldset.list).toBe('CODPROD,DESCRPROD');
    expect(ds.criteria).toBeUndefined();
  });

  it('inclui critério com parâmetros tipados (inferidos)', () => {
    const req = buildLoadRecordsPayload({
      entity: 'Produto',
      fields: ['CODPROD'],
      criteria: {
        expression: 'this.CODPROD = ? AND this.DESCRPROD like ?',
        parameters: [{ value: 123 }, { value: '%CANETA%' }],
      },
    });
    const crit = (req.requestBody as any).dataSet.criteria;
    expect(crit.expression).toEqual({ $: 'this.CODPROD = ? AND this.DESCRPROD like ?' });
    expect(crit.parameter).toEqual([
      { $: '123', type: 'I' },
      { $: '%CANETA%', type: 'S' },
    ]);
  });

  it('respeita includePresentationFields=true', () => {
    const req = buildLoadRecordsPayload({
      entity: 'Produto',
      fields: ['CODPROD'],
      includePresentationFields: true,
    });
    expect((req.requestBody as any).dataSet.includePresentationFields).toBe('S');
  });

  it('valida entrada', () => {
    expect(() => buildLoadRecordsPayload({ entity: '', fields: ['X'] })).toThrow();
    expect(() => buildLoadRecordsPayload({ entity: 'P', fields: [] })).toThrow();
  });
});

describe('buildSaveRecordPayload', () => {
  it('faz UPDATE quando key é informada', () => {
    const req = buildSaveRecordPayload({
      entity: 'Produto',
      values: { DESCRPROD: 'NOVO NOME' },
      key: { CODPROD: 123 },
    });
    expect(req.serviceName).toBe(SERVICE_SAVE_RECORD);
    const ds = (req.requestBody as any).dataSet;
    expect(ds.dataRow.localFields).toEqual({ DESCRPROD: { $: 'NOVO NOME' } });
    expect(ds.dataRow.key).toEqual({ CODPROD: { $: '123' } });
    expect(ds.entity.fieldset.list).toBe('CODPROD');
  });

  it('faz INSERT (sem key) e não inclui dataRow.key', () => {
    const req = buildSaveRecordPayload({
      entity: 'Produto',
      values: { DESCRPROD: 'CANETA', ATIVO: 'S' },
    });
    const ds = (req.requestBody as any).dataSet;
    expect(ds.dataRow.key).toBeUndefined();
    expect(ds.dataRow.localFields).toEqual({
      DESCRPROD: { $: 'CANETA' },
      ATIVO: { $: 'S' },
    });
    expect(ds.entity).toBeUndefined();
  });

  it('converte null em string vazia', () => {
    const req = buildSaveRecordPayload({
      entity: 'Produto',
      values: { OBS: null },
      key: { CODPROD: 1 },
    });
    expect((req.requestBody as any).dataSet.dataRow.localFields.OBS).toEqual({ $: '' });
  });

  it('valida entrada', () => {
    expect(() => buildSaveRecordPayload({ entity: '', values: { A: 1 } })).toThrow();
    expect(() => buildSaveRecordPayload({ entity: 'P', values: {} })).toThrow();
  });
});

describe('unwrapValue', () => {
  it('remove a embalagem { $ }', () => {
    expect(unwrapValue({ $: '42' })).toBe('42');
    expect(unwrapValue('plain')).toBe('plain');
    expect(unwrapValue({ a: 1 })).toEqual({ a: 1 });
  });
});

describe('parseLoadRecordsResult', () => {
  it('remapeia campos posicionais fN usando metadata e detecta hasMoreResult', () => {
    const envelope = {
      status: '1',
      responseBody: {
        entities: {
          hasMoreResult: 'true',
          metadata: {
            fields: { field: [{ name: 'CODPROD' }, { name: 'DESCRPROD' }] },
          },
          entity: [
            { f0: { $: '1' }, f1: { $: 'CANETA' } },
            { f0: { $: '2' }, f1: { $: 'LAPIS' } },
          ],
        },
      },
    };
    const result = parseLoadRecordsResult(envelope, 0);
    expect(result.hasMoreResult).toBe(true);
    expect(result.records).toEqual([
      { CODPROD: '1', DESCRPROD: 'CANETA' },
      { CODPROD: '2', DESCRPROD: 'LAPIS' },
    ]);
  });

  it('lida com entity único (não-array) e sem metadata', () => {
    const envelope = {
      status: '1',
      responseBody: {
        entities: {
          hasMoreResult: 'false',
          entity: { CODPROD: { $: '9' } },
        },
      },
    };
    const result = parseLoadRecordsResult(envelope, 1);
    expect(result.hasMoreResult).toBe(false);
    expect(result.offsetPage).toBe(1);
    expect(result.records).toEqual([{ CODPROD: '9' }]);
  });

  it('retorna lista vazia quando não há entidades', () => {
    const result = parseLoadRecordsResult({ status: '1', responseBody: {} }, 0);
    expect(result.records).toEqual([]);
    expect(result.hasMoreResult).toBe(false);
  });
});

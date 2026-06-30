/**
 * Construção e parsing dos payloads dos serviços CRUD do Gateway.
 *
 * A API Sankhya embrulha valores escalares em `{ "$": "valor" }`. Estes helpers
 * isolam essa convenção do resto do código. As estruturas de REQUISIÇÃO seguem a
 * documentação oficial (loadRecords/saveRecord); o PARSING da resposta é
 * best-effort e expõe sempre o objeto cru (`raw`) para casos não cobertos.
 *
 * Doc: https://developer.sankhya.com.br/reference/loadrecords
 *      https://developer.sankhya.com.br/reference/saverecord
 */
import type {
  CriteriaParameter,
  LoadRecordsInput,
  LoadRecordsResult,
  SankhyaParamType,
  SaveRecordInput,
  ServiceEnvelope,
} from './types.js';

export const SERVICE_LOAD_RECORDS = 'CRUDServiceProvider.loadRecords';
export const SERVICE_SAVE_RECORD = 'CRUDServiceProvider.saveRecord';
export const SERVICE_EXECUTE_QUERY = 'DbExplorerSP.executeQuery';

/** Envelope `{ serviceName, requestBody }` enviado ao Gateway. */
export interface ServiceRequest {
  serviceName: string;
  requestBody: Record<string, unknown>;
}

/** Embrulha um escalar na convenção `{ "$": "valor" }` da API. */
export function wrapScalar(value: string | number | boolean): { $: string } {
  return { $: String(value) };
}

/** Infere o `type` de um parâmetro quando não informado. */
export function inferParamType(value: string | number | boolean): SankhyaParamType {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'I' : 'F';
  }
  // booleanos e strings caem em string; a API trata "S"/"N" como texto.
  return 'S';
}

function buildParameters(parameters: CriteriaParameter[] | undefined): Array<{
  $: string;
  type: SankhyaParamType;
}> {
  return (parameters ?? []).map((p) => ({
    $: String(p.value),
    type: p.type ?? inferParamType(p.value),
  }));
}

/**
 * Monta o payload de uma consulta múltipla (loadRecords).
 *
 * Exemplo de saída (resumido):
 * ```json
 * {
 *   "serviceName": "CRUDServiceProvider.loadRecords",
 *   "requestBody": {
 *     "dataSet": {
 *       "rootEntity": "Produto",
 *       "includePresentationFields": "N",
 *       "offsetPage": "0",
 *       "criteria": { "expression": { "$": "this.CODPROD = ?" },
 *                     "parameter": [ { "$": "123", "type": "I" } ] },
 *       "entity": { "fieldset": { "list": "CODPROD,DESCRPROD" } }
 *     }
 *   }
 * }
 * ```
 */
export function buildLoadRecordsPayload(input: LoadRecordsInput): ServiceRequest {
  if (!input.entity) {
    throw new Error('loadRecords requer "entity".');
  }
  if (!input.fields || input.fields.length === 0) {
    throw new Error('loadRecords requer ao menos um campo em "fields".');
  }

  const dataSet: Record<string, unknown> = {
    rootEntity: input.entity,
    includePresentationFields: input.includePresentationFields ? 'S' : 'N',
    offsetPage: String(input.offsetPage ?? 0),
    entity: {
      fieldset: { list: input.fields.join(',') },
    },
  };

  if (input.criteria?.expression) {
    dataSet.criteria = {
      expression: { $: input.criteria.expression },
      parameter: buildParameters(input.criteria.parameters),
    };
  }

  return {
    serviceName: SERVICE_LOAD_RECORDS,
    requestBody: { dataSet },
  };
}

/**
 * Monta o payload de upsert (saveRecord).
 *
 * Se `key` for informada e existir no banco → UPDATE; caso contrário → INSERT.
 * A API não usa PUT: o saveRecord decide pela PK.
 */
export function buildSaveRecordPayload(input: SaveRecordInput): ServiceRequest {
  if (!input.entity) {
    throw new Error('saveRecord requer "entity".');
  }
  if (!input.values || Object.keys(input.values).length === 0) {
    throw new Error('saveRecord requer ao menos um campo em "values".');
  }

  const localFields: Record<string, { $: string }> = {};
  for (const [field, value] of Object.entries(input.values)) {
    // null → string vazia (limpa o campo). A API não aceita null cru aqui.
    localFields[field] = wrapScalar(value === null ? '' : value);
  }

  const dataRow: Record<string, unknown> = { localFields };
  if (input.key && Object.keys(input.key).length > 0) {
    const key: Record<string, { $: string }> = {};
    for (const [field, value] of Object.entries(input.key)) {
      key[field] = wrapScalar(value);
    }
    dataRow.key = key;
  }

  // Campos a retornar no resultado: as PKs (úteis após INSERT para obter a PK gerada).
  const returnFields = input.key ? Object.keys(input.key) : [];

  const dataSet: Record<string, unknown> = {
    rootEntity: input.entity,
    includePresentationFields: 'S',
    dataRow,
  };
  if (returnFields.length > 0) {
    dataSet.entity = { fieldset: { list: returnFields.join(',') } };
  }

  return {
    serviceName: SERVICE_SAVE_RECORD,
    requestBody: { dataSet },
  };
}

/** Remove a embalagem `{ "$": v }` de um valor, recursivamente em objetos. */
export function unwrapValue(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 1 && keys[0] === '$') {
      return obj.$;
    }
  }
  return value;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseBoolish(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return false;
}

/**
 * Normaliza a resposta de loadRecords em registros campo→valor.
 *
 * A resposta usa `responseBody.entities` com `metadata.fields.field[]` definindo
 * a ordem dos campos, e cada linha em `entities.entity[]` com chaves posicionais
 * `f0`, `f1`, ... que remapeamos para os nomes reais. Quando o formato não bate,
 * devolvemos a linha como veio (após unwrap). O objeto cru fica em `raw`.
 *
 * TODO: validar variações de formato (presentationFields, entidades aninhadas)
 * contra a doc oficial conforme surgirem casos reais.
 */
export function parseLoadRecordsResult(
  envelope: ServiceEnvelope,
  offsetPage: number,
): LoadRecordsResult {
  const responseBody = (envelope.responseBody ?? {}) as Record<string, unknown>;
  const entities = (responseBody.entities ?? {}) as Record<string, unknown>;

  // Mapa de índice posicional (f0, f1, ...) → nome do campo, via metadata.
  const metadataFields = asArray(
    ((entities.metadata as Record<string, unknown>)?.fields as Record<string, unknown>)
      ?.field as unknown,
  ) as Array<Record<string, unknown>>;
  const fieldNames = metadataFields
    .map((f) => (typeof f?.name === 'string' ? f.name : undefined))
    .filter((n): n is string => Boolean(n));

  const rows = asArray(entities.entity as unknown) as Array<Record<string, unknown>>;

  const records = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, rawVal] of Object.entries(row)) {
      const value = unwrapValue(rawVal);
      const positional = /^f(\d+)$/.exec(key);
      if (positional && fieldNames.length > 0) {
        const idx = Number.parseInt(positional[1]!, 10);
        const name = fieldNames[idx] ?? key;
        out[name] = value;
      } else {
        out[key] = value;
      }
    }
    return out;
  });

  return {
    records,
    hasMoreResult: parseBoolish(entities.hasMoreResult),
    offsetPage,
    raw: envelope,
  };
}

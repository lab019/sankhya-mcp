/**
 * `SankhyaClient`: ponto único de acesso à API.
 *
 * Responsabilidades:
 * - montar URLs de serviço do Gateway (`service.sbr`);
 * - injetar o token (via `TokenManager`) e renovar em caso de 401;
 * - serializar/parsear o envelope de serviço e mapear erros tipados;
 * - oferecer helpers de alto nível: `loadRecords`, `loadRecord`, `saveRecord`,
 *   chamada genérica `callService`, e `executeQuery` (guardada por política).
 *
 * As credenciais ficam encapsuladas aqui; nada sensível é retornado aos callers.
 */
import { TokenManager, type Clock } from './auth.js';
import type { SankhyaConfig } from './config.js';
import { SankhyaApiError, SankhyaPolicyError, errorFromHttpStatus } from './errors.js';
import { httpRequest, tryParseJson, type FetchLike } from './http.js';
import {
  SERVICE_EXECUTE_QUERY,
  buildLoadRecordsPayload,
  buildSaveRecordPayload,
  parseLoadRecordsResult,
  type ServiceRequest,
} from './payloads.js';
import { redact } from './redact.js';
import type {
  LoadRecordInput,
  LoadRecordsInput,
  LoadRecordsResult,
  SankhyaModule,
  SaveRecordInput,
  ServiceEnvelope,
} from './types.js';

export interface SankhyaClientOptions {
  config: SankhyaConfig;
  fetchImpl?: FetchLike;
  clock?: Clock;
  /** Permite injetar um TokenManager já configurado (testes). */
  tokenManager?: TokenManager;
  /** Habilita `executeQuery` (SQL livre). Default false (perigoso). */
  allowRawSql?: boolean;
}

const DEFAULT_MODULE: SankhyaModule = 'mge';

export class SankhyaClient {
  readonly config: SankhyaConfig;
  private readonly fetchImpl: FetchLike;
  private readonly tokens: TokenManager;
  private readonly allowRawSql: boolean;

  constructor(options: SankhyaClientOptions) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.tokens =
      options.tokenManager ??
      new TokenManager({
        config: options.config,
        fetchImpl: options.fetchImpl,
        clock: options.clock,
      });
    this.allowRawSql = options.allowRawSql ?? false;
  }

  /** Monta a URL de um serviço do Gateway. */
  buildServiceUrl(module: SankhyaModule, serviceName: string): string {
    const params = new URLSearchParams({ serviceName, outputType: 'json' });
    return `${this.config.baseUrl}/gateway/v1/${module}/service.sbr?${params.toString()}`;
  }

  /**
   * Chamada genérica de serviço do Gateway. Retorna o envelope já validado
   * (status de sucesso). Renova o token e tenta novamente uma vez em caso de 401.
   */
  async callService(
    serviceName: string,
    requestBody: Record<string, unknown>,
    module: SankhyaModule = DEFAULT_MODULE,
  ): Promise<ServiceEnvelope> {
    return this.executeServiceRequest({ serviceName, requestBody }, module, true);
  }

  private async executeServiceRequest(
    request: ServiceRequest,
    module: SankhyaModule,
    retryOnAuth: boolean,
  ): Promise<ServiceEnvelope> {
    const url = this.buildServiceUrl(module, request.serviceName);
    const authHeader = await this.tokens.getAuthorizationHeader();

    const response = await httpRequest(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(request),
        timeoutMs: this.config.httpTimeoutMs,
      },
      this.fetchImpl,
    );

    // Token expirado/ inválido: invalida cache e tenta uma única vez de novo.
    if (response.status === 401 && retryOnAuth) {
      this.tokens.invalidate();
      return this.executeServiceRequest(request, module, false);
    }

    const parsed = tryParseJson(response.text) as ServiceEnvelope | undefined;

    if (!response.ok) {
      throw errorFromHttpStatus(response.status, redact(parsed), parsed?.statusMessage);
    }

    // HTTP 200 mas a API pode sinalizar erro no envelope (`status !== "1"`).
    if (parsed && parsed.status !== undefined && parsed.status !== '1') {
      throw new SankhyaApiError(
        `A API retornou status "${parsed.status}"${
          parsed.statusMessage ? `: ${parsed.statusMessage}` : ''
        }.`,
        {
          httpStatus: response.status,
          responseBody: redact(parsed),
          apiStatusMessage: parsed.statusMessage,
        },
      );
    }

    return parsed ?? {};
  }

  /** Consulta múltipla (loadRecords) já normalizada. */
  async loadRecords(input: LoadRecordsInput): Promise<LoadRecordsResult> {
    const request = buildLoadRecordsPayload(input);
    const envelope = await this.executeServiceRequest(
      request,
      input.module ?? DEFAULT_MODULE,
      true,
    );
    return parseLoadRecordsResult(envelope, input.offsetPage ?? 0);
  }

  /**
   * Carrega um único registro pela chave primária.
   *
   * Implementado via loadRecords filtrando pela PK (abordagem robusta e bem
   * documentada), retornando o primeiro registro ou `undefined`.
   */
  async loadRecord(input: LoadRecordInput): Promise<Record<string, unknown> | undefined> {
    const keyEntries = Object.entries(input.key);
    if (keyEntries.length === 0) {
      throw new Error('loadRecord requer ao menos um campo de chave em "key".');
    }

    const expression = keyEntries.map(([field]) => `this.${field} = ?`).join(' AND ');
    const parameters = keyEntries.map(([, value]) => ({ value }));
    // Sem `fields` explícito, retorna ao menos as chaves.
    const fields =
      input.fields && input.fields.length > 0 ? input.fields : keyEntries.map(([f]) => f);

    const result = await this.loadRecords({
      entity: input.entity,
      fields,
      criteria: { expression, parameters },
      offsetPage: 0,
      module: input.module,
    });
    return result.records[0];
  }

  /** Upsert de um registro (saveRecord). Retorna o envelope da API. */
  async saveRecord(input: SaveRecordInput): Promise<ServiceEnvelope> {
    const request = buildSaveRecordPayload(input);
    return this.executeServiceRequest(request, input.module ?? DEFAULT_MODULE, true);
  }

  /** Constrói (sem enviar) o payload de saveRecord — usado pelo modo dry-run. */
  buildSaveRecordRequest(input: SaveRecordInput): ServiceRequest {
    return buildSaveRecordPayload(input);
  }

  /**
   * Executa SQL livre (DbExplorerSP.executeQuery).
   *
   * PERIGOSO: acesso direto ao banco. Desabilitado por padrão; só funciona se o
   * cliente foi criado com `allowRawSql: true` (opt-in explícito do operador).
   */
  async executeQuery(
    sql: string,
    module: SankhyaModule = DEFAULT_MODULE,
  ): Promise<ServiceEnvelope> {
    if (!this.allowRawSql) {
      throw new SankhyaPolicyError(
        'executeQuery (SQL livre) está desabilitado. Habilite com SANKHYA_ALLOW_RAW_SQL=true por sua conta e risco.',
      );
    }
    return this.executeServiceRequest(
      { serviceName: SERVICE_EXECUTE_QUERY, requestBody: { sql } },
      module,
      true,
    );
  }
}

/** Cria um `SankhyaClient` a partir da configuração e opções. */
export function createClient(options: SankhyaClientOptions): SankhyaClient {
  return new SankhyaClient(options);
}

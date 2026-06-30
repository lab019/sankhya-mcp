/**
 * Hierarquia de erros tipados.
 *
 * Todas as mensagens passam por `redactString` para garantir que nenhum segredo
 * vaze. Mapeamos status HTTP da API Sankhya em erros claros e acionáveis.
 */
import { redactString } from './redact.js';

/** Base de todos os erros do projeto. */
export class SankhyaError extends Error {
  /** Código estável legível por máquina. */
  readonly code: string;

  constructor(message: string, code = 'SANKHYA_ERROR') {
    super(redactString(message));
    this.name = new.target.name;
    this.code = code;
    // Mantém o protótipo correto ao transpilar para ES2022/CommonJS.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Configuração ausente ou inválida (ex.: env var faltando). */
export class SankhyaConfigError extends SankhyaError {
  constructor(message: string) {
    super(message, 'SANKHYA_CONFIG_ERROR');
  }
}

/** Falha de autenticação / token (HTTP 401 ou erro no /authenticate). */
export class SankhyaAuthError extends SankhyaError {
  constructor(message: string) {
    super(message, 'SANKHYA_AUTH_ERROR');
  }
}

/**
 * Erro retornado pela API em uma chamada de serviço/REST.
 * Inclui status HTTP e o corpo (já redigido) para diagnóstico.
 */
export class SankhyaApiError extends SankhyaError {
  readonly httpStatus: number;
  readonly responseBody: unknown;
  /** Mensagem de status da própria API Sankhya, quando disponível. */
  readonly apiStatusMessage?: string;

  constructor(
    message: string,
    options: { httpStatus: number; responseBody?: unknown; apiStatusMessage?: string },
  ) {
    super(message, 'SANKHYA_API_ERROR');
    this.httpStatus = options.httpStatus;
    this.responseBody = options.responseBody;
    this.apiStatusMessage = options.apiStatusMessage;
  }
}

/** Falha de rede / timeout antes de obter uma resposta HTTP. */
export class SankhyaNetworkError extends SankhyaError {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message, 'SANKHYA_NETWORK_ERROR');
  }
}

/** Operação bloqueada por política de segurança (read-only, SQL desabilitado, etc.). */
export class SankhyaPolicyError extends SankhyaError {
  constructor(message: string) {
    super(message, 'SANKHYA_POLICY_ERROR');
  }
}

/**
 * Constrói o erro apropriado a partir de uma resposta HTTP com status de falha.
 * Mapeia faixas de status em mensagens claras sem expor segredos.
 */
export function errorFromHttpStatus(
  httpStatus: number,
  body: unknown,
  apiStatusMessage?: string,
): SankhyaError {
  const detail = apiStatusMessage ? `: ${apiStatusMessage}` : '';
  if (httpStatus === 401 || httpStatus === 403) {
    return new SankhyaAuthError(
      `Não autorizado (HTTP ${httpStatus})${detail}. Verifique credenciais e X-Token.`,
    );
  }
  if (httpStatus === 400 || httpStatus === 422) {
    return new SankhyaApiError(`Requisição inválida (HTTP ${httpStatus})${detail}.`, {
      httpStatus,
      responseBody: body,
      apiStatusMessage,
    });
  }
  if (httpStatus >= 500) {
    return new SankhyaApiError(`Erro no servidor Sankhya (HTTP ${httpStatus})${detail}.`, {
      httpStatus,
      responseBody: body,
      apiStatusMessage,
    });
  }
  return new SankhyaApiError(`Erro inesperado (HTTP ${httpStatus})${detail}.`, {
    httpStatus,
    responseBody: body,
    apiStatusMessage,
  });
}

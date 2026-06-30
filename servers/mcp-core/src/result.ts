/**
 * Helpers para formatar resultados e erros das tools MCP.
 *
 * Todo erro é redigido (sem segredos) antes de chegar ao LLM.
 */
import { redact, SankhyaError } from '@sankhya-mcp/core';

export interface ToolTextResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  // O tipo CallToolResult do SDK exige uma assinatura de índice aberta.
  [key: string]: unknown;
}

/** Resultado de sucesso com um objeto serializado como JSON. */
export function jsonResult(data: unknown): ToolTextResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(redact(data), null, 2) }],
  };
}

/** Resultado de texto simples. */
export function textResult(text: string): ToolTextResult {
  return { content: [{ type: 'text', text }] };
}

/**
 * Converte qualquer exceção num resultado de erro seguro para o LLM.
 * Erros conhecidos viram mensagem clara; o resto é genérico (sem stack/segredos).
 */
export function errorResult(err: unknown): ToolTextResult {
  if (err instanceof SankhyaError) {
    return {
      content: [{ type: 'text', text: `[${err.code}] ${err.message}` }],
      isError: true,
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: 'text', text: `Erro inesperado: ${message}` }],
    isError: true,
  };
}

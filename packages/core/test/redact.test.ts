import { describe, it, expect, beforeEach } from 'vitest';
import { redact, redactString, registerSecret, clearSecrets } from '../src/redact.js';
import {
  SankhyaError,
  SankhyaApiError,
  errorFromHttpStatus,
  SankhyaAuthError,
} from '../src/errors.js';

describe('redact', () => {
  beforeEach(() => clearSecrets());

  it('mascara segredos registrados em strings', () => {
    registerSecret('super-secret-jwt');
    expect(redactString('Bearer super-secret-jwt foo')).not.toContain('super-secret-jwt');
  });

  it('mascara valores sob chaves sensíveis', () => {
    const out = redact({
      client_secret: 'abc',
      Authorization: 'Bearer xyz',
      X_Token: 'tok',
      nome: 'visível',
    }) as Record<string, string>;
    expect(out.client_secret).not.toBe('abc');
    expect(out.Authorization).not.toContain('xyz');
    expect(out.X_Token).not.toBe('tok');
    expect(out.nome).toBe('visível');
  });

  it('é resiliente a referências circulares', () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(() => redact(a)).not.toThrow();
  });
});

describe('errors', () => {
  beforeEach(() => clearSecrets());

  it('SankhyaError redige segredos na mensagem', () => {
    registerSecret('leak-token');
    const err = new SankhyaError('falhou com leak-token no meio');
    expect(err.message).not.toContain('leak-token');
  });

  it('errorFromHttpStatus mapeia 401/403 em auth', () => {
    expect(errorFromHttpStatus(401, {})).toBeInstanceOf(SankhyaAuthError);
    expect(errorFromHttpStatus(403, {})).toBeInstanceOf(SankhyaAuthError);
  });

  it('errorFromHttpStatus mapeia 400 e 500 em SankhyaApiError com status', () => {
    const e400 = errorFromHttpStatus(400, { x: 1 }, 'campo inválido') as SankhyaApiError;
    expect(e400).toBeInstanceOf(SankhyaApiError);
    expect(e400.httpStatus).toBe(400);
    expect(e400.apiStatusMessage).toBe('campo inválido');

    const e500 = errorFromHttpStatus(500, {}) as SankhyaApiError;
    expect(e500.httpStatus).toBe(500);
  });
});

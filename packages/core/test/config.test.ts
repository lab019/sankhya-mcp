import { describe, it, expect } from 'vitest';
import { loadConfigFromEnv, loadSecurityOptionsFromEnv, baseUrlForEnv } from '../src/config.js';
import { SankhyaConfigError } from '../src/errors.js';

const baseEnv = {
  SANKHYA_CLIENT_ID: 'cid',
  SANKHYA_CLIENT_SECRET: 'csecret',
  SANKHYA_X_TOKEN: 'xtok',
} as NodeJS.ProcessEnv;

describe('loadConfigFromEnv', () => {
  it('lança erro listando credenciais ausentes', () => {
    expect(() => loadConfigFromEnv({} as NodeJS.ProcessEnv)).toThrow(SankhyaConfigError);
    try {
      loadConfigFromEnv({ SANKHYA_CLIENT_ID: 'x' } as NodeJS.ProcessEnv);
    } catch (e) {
      expect((e as Error).message).toContain('SANKHYA_CLIENT_SECRET');
      expect((e as Error).message).toContain('SANKHYA_X_TOKEN');
      expect((e as Error).message).not.toContain('SANKHYA_CLIENT_ID');
    }
  });

  it('usa sandbox como default de ambiente (segurança)', () => {
    const cfg = loadConfigFromEnv(baseEnv);
    expect(cfg.env).toBe('sandbox');
    expect(cfg.baseUrl).toBe('https://api.sandbox.sankhya.com.br');
  });

  it('exige opt-in explícito para produção', () => {
    const cfg = loadConfigFromEnv({ ...baseEnv, SANKHYA_ENV: 'production' });
    expect(cfg.env).toBe('production');
    expect(cfg.baseUrl).toBe('https://api.sankhya.com.br');
  });

  it('rejeita SANKHYA_ENV inválido', () => {
    expect(() => loadConfigFromEnv({ ...baseEnv, SANKHYA_ENV: 'staging' })).toThrow(
      SankhyaConfigError,
    );
  });

  it('permite sobrescrever a base URL e remove barra final', () => {
    const cfg = loadConfigFromEnv({ ...baseEnv, SANKHYA_BASE_URL: 'https://proxy.local/' });
    expect(cfg.baseUrl).toBe('https://proxy.local');
  });

  it('aplica defaults numéricos quando inválidos', () => {
    const cfg = loadConfigFromEnv({
      ...baseEnv,
      SANKHYA_TOKEN_REFRESH_SKEW: 'abc',
      SANKHYA_HTTP_TIMEOUT: '',
    });
    expect(cfg.tokenRefreshSkewSeconds).toBe(60);
    expect(cfg.httpTimeoutMs).toBe(30_000);
  });
});

describe('loadSecurityOptionsFromEnv', () => {
  it('default é seguro: read-only off, dry-run off, sql off', () => {
    expect(loadSecurityOptionsFromEnv({} as NodeJS.ProcessEnv)).toEqual({
      readOnly: false,
      dryRun: false,
      allowRawSql: false,
    });
  });

  it('aceita variações de booleano', () => {
    const opts = loadSecurityOptionsFromEnv({
      SANKHYA_READ_ONLY: 'TRUE',
      SANKHYA_DRY_RUN: '1',
      SANKHYA_ALLOW_RAW_SQL: 'yes',
    } as NodeJS.ProcessEnv);
    expect(opts).toEqual({ readOnly: true, dryRun: true, allowRawSql: true });
  });
});

describe('baseUrlForEnv', () => {
  it('mapeia ambientes', () => {
    expect(baseUrlForEnv('production')).toBe('https://api.sankhya.com.br');
    expect(baseUrlForEnv('sandbox')).toBe('https://api.sandbox.sankhya.com.br');
  });
});

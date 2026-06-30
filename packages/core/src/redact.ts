/**
 * Redação de segredos.
 *
 * CRÍTICO (projeto open source): client_id, client_secret, X-Token e o JWT de
 * acesso NUNCA podem aparecer em logs, mensagens de erro ou em qualquer conteúdo
 * exposto ao LLM. Use `redact()` antes de logar e `registerSecret()` para que
 * valores dinâmicos (como o JWT atual) também sejam mascarados.
 */

const MASK = '«redacted»';

/** Conjunto de segredos literais conhecidos em runtime (ex.: o JWT atual). */
const knownSecrets = new Set<string>();

/**
 * Registra um valor sensível para que seja mascarado em qualquer redação futura.
 * Chamado pelo TokenManager ao obter um novo JWT e pela config ao ler env vars.
 */
export function registerSecret(secret: string | undefined | null): void {
  if (secret && secret.length >= 4) {
    knownSecrets.add(secret);
  }
}

/** Remove um segredo do conjunto (ex.: token expirado). */
export function unregisterSecret(secret: string | undefined | null): void {
  if (secret) {
    knownSecrets.delete(secret);
  }
}

/** Limpa todos os segredos registrados (útil em testes). */
export function clearSecrets(): void {
  knownSecrets.clear();
}

/**
 * Chaves cujos valores devem ser mascarados ao redigir objetos,
 * independentemente do conteúdo.
 */
const SENSITIVE_KEY_PATTERN =
  /(client[_-]?secret|client[_-]?id|x[_-]?token|authorization|access[_-]?token|bearer|password|secret|senha)/i;

/**
 * Retorna uma cópia segura para log de qualquer valor: mascara segredos
 * registrados e valores sob chaves sensíveis. Nunca lança.
 */
export function redact(value: unknown): unknown {
  try {
    return redactInner(value, new WeakSet());
  } catch {
    return MASK;
  }
}

/** Versão string conveniente para mensagens. */
export function redactString(text: string): string {
  let out = text;
  for (const secret of knownSecrets) {
    out = out.split(secret).join(MASK);
  }
  return out;
}

function redactInner(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value as object)) {
    return '«circular»';
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redactInner(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = MASK;
    } else {
      result[key] = redactInner(val, seen);
    }
  }
  return result;
}

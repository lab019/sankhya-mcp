#!/usr/bin/env node
/**
 * CLI de validação de credenciais Sankhya (LIC-157).
 *
 * Pré-requisito da PoC/demo: confirma que as credenciais OAuth de SANDBOX estão
 * corretas e que o ambiente tem dados de exemplo para a demonstração.
 *
 * Uso:
 *   sankhya-validate-credentials [--dotenv <caminho>] [--allow-production]
 *
 * Lê as credenciais de variáveis de ambiente (e, por conveniência, de um arquivo
 * `.env` local que NUNCA deve ser commitado). Os segredos ficam só no ambiente;
 * nada sensível é impresso — apenas ambiente, tipo de token, validade e contagens.
 *
 * Segurança: começa SEMPRE em sandbox. Rodar contra PRODUÇÃO exige opt-in
 * explícito (`--allow-production` ou `SANKHYA_ALLOW_PRODUCTION=true`).
 *
 * Códigos de saída: 0 = tudo OK; 1 = alguma checagem falhou; 2 = erro de
 * configuração/uso (credenciais ausentes, opt-in de produção faltando, etc.).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  loadConfigFromEnv,
  runPreflight,
  SankhyaConfigError,
  type PreflightReport,
} from '../index.js';

interface CliArgs {
  envFile: string;
  allowProduction: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { envFile: '.env', allowProduction: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--allow-production') {
      args.allowProduction = true;
    } else if (arg === '--dotenv') {
      const next = argv[++i];
      if (!next) throw new SankhyaConfigError('--dotenv requer um caminho.');
      args.envFile = next;
    } else if (arg.startsWith('--dotenv=')) {
      args.envFile = arg.slice('--dotenv='.length);
    } else {
      throw new SankhyaConfigError(`Argumento desconhecido: ${arg}`);
    }
  }
  return args;
}

const HELP = `sankhya-validate-credentials — valida credenciais OAuth da Sankhya (PoC).

Confirma que POST /authenticate retorna um JWT e que há dados de exemplo
(produtos, parceiros) no ambiente para a demo.

Uso:
  sankhya-validate-credentials [opções]

Opções:
  --dotenv <caminho>     Arquivo .env a carregar (default: ./.env).
  --allow-production     Permite rodar contra produção (opt-in explícito).
  -h, --help             Mostra esta ajuda.

Variáveis de ambiente (ver .env.example):
  SANKHYA_CLIENT_ID, SANKHYA_CLIENT_SECRET, SANKHYA_X_TOKEN (obrigatórias)
  SANKHYA_ENV (sandbox|production, default sandbox)
  SANKHYA_ALLOW_PRODUCTION (alternativa a --allow-production)
`;

/**
 * Carrega um `.env` simples para `process.env`, SEM sobrescrever variáveis já
 * definidas no ambiente (o ambiente real tem precedência). Parser minimalista
 * e sem dependências: `KEY=VALUE`, ignora linhas vazias/comentários, remove
 * aspas e o prefixo opcional `export`.
 */
function loadDotEnvIfPresent(path: string): boolean {
  let content: string;
  try {
    content = readFileSync(resolve(path), 'utf8');
  } catch {
    return false;
  }
  for (const rawLine of content.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice('export '.length).trim();
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
  return true;
}

function formatReport(report: PreflightReport): string {
  const lines: string[] = [];
  const mark = (ok: boolean) => (ok ? '[ OK ]' : '[FALHA]');

  lines.push('Sankhya — validação de credenciais');
  lines.push(`Ambiente: ${report.env} (${report.baseUrl})`);
  lines.push('');

  if (report.auth.ok) {
    lines.push(
      `${mark(true)} Autenticação OAuth: JWT obtido (${report.auth.tokenType}, expira em ~${report.auth.expiresInSeconds}s).`,
    );
  } else {
    lines.push(`${mark(false)} Autenticação OAuth: ${report.auth.error ?? 'falhou.'}`);
  }

  for (const check of report.data) {
    if (check.skipped) {
      lines.push(`[ -- ] ${check.label}: pulado (autenticação falhou).`);
    } else if (check.ok) {
      const more = check.hasMoreResult ? '+' : '';
      lines.push(
        `${mark(true)} ${check.label}: ${check.count}${more} registro(s) de exemplo encontrados.`,
      );
    } else if (check.error) {
      lines.push(`${mark(false)} ${check.label}: ${check.error}`);
    } else {
      lines.push(`${mark(false)} ${check.label}: nenhum registro de exemplo encontrado.`);
    }
  }

  lines.push('');
  lines.push(
    report.ok
      ? 'Resultado: OK — credenciais válidas e ambiente com dados para a demo.'
      : 'Resultado: FALHA — veja os itens marcados acima.',
  );
  return lines.join('\n');
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }

  loadDotEnvIfPresent(args.envFile);

  const config = loadConfigFromEnv();

  // Guarda de produção: começa SEMPRE em sandbox.
  const envOptIn = ['1', 'true', 'yes', 'y', 'on'].includes(
    (process.env.SANKHYA_ALLOW_PRODUCTION ?? '').trim().toLowerCase(),
  );
  if (config.env === 'production' && !(args.allowProduction || envOptIn)) {
    process.stderr.write(
      'Recusando validar contra PRODUÇÃO sem opt-in explícito.\n' +
        'Comece sempre em sandbox. Para produção, use --allow-production ' +
        '(ou SANKHYA_ALLOW_PRODUCTION=true) — apenas após a demo.\n',
    );
    return 2;
  }

  const report = await runPreflight({ config });
  process.stdout.write(formatReport(report) + '\n');
  return report.ok ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    if (err instanceof SankhyaConfigError) {
      process.stderr.write(`Erro de configuração: ${err.message}\n`);
    } else {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Falha ao validar credenciais: ${message}\n`);
    }
    process.exit(2);
  });

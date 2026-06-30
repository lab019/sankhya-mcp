# Credenciais de sandbox & validação (PoC)

> Pré-requisito da demo. Antes de conectar qualquer servidor MCP, confirme que as
> credenciais OAuth de **sandbox** funcionam e que o ambiente tem dados de exemplo.

## 1. Obter as credenciais OAuth (sandbox)

Peça ao cliente as três credenciais de **sandbox** (ambiente seguro de testes):

| Variável                | O que é                                          |
| ----------------------- | ------------------------------------------------ |
| `SANKHYA_CLIENT_ID`     | Client ID OAuth 2.0 (Client Credentials).        |
| `SANKHYA_CLIENT_SECRET` | Client Secret OAuth.                             |
| `SANKHYA_X_TOKEN`       | Token da aplicação no portal (header `X-Token`). |

> ⚠️ **Comece SEMPRE em sandbox.** Produção (`SANKHYA_ENV=production`) só com
> opt-in explícito e **após** a demo. As credenciais de sandbox e produção são
> independentes.

## 2. Guardar os segredos com segurança

- **Nunca** commite credenciais. O `.gitignore` já ignora `.env`.
- Para uso local, copie `.env.example` para `.env` e preencha os valores:

  ```bash
  cp .env.example .env
  # edite .env e preencha SANKHYA_CLIENT_ID, SANKHYA_CLIENT_SECRET, SANKHYA_X_TOKEN
  ```

- Em CI/produção, injete via variáveis de ambiente ou um cofre de segredos
  (1Password, Vault, AWS Secrets Manager, etc.) — não em arquivo no repositório.
- Os segredos ficam **somente no servidor**: o núcleo registra `client_id`,
  `client_secret`, `X-Token` e o JWT para **redação automática**, então eles nunca
  aparecem em logs, mensagens de erro ou no contexto do LLM.

## 3. Validar as credenciais

A ferramenta `sankhya-validate-credentials` confirma os critérios de aceite da PoC:

1. `POST /authenticate` retorna um JWT no ambiente sandbox; e
2. há dados de exemplo (produtos, parceiros) para a demo.

Após `pnpm build`:

```bash
# usando o .env local
pnpm validate:credentials

# ou diretamente, com um arquivo .env específico
node packages/core/dist/bin/validate-credentials.js --dotenv ./.env
```

Saída esperada (nenhum segredo é impresso):

```text
Sankhya — validação de credenciais
Ambiente: sandbox (https://api.sandbox.sankhya.com.br)

[ OK ] Autenticação OAuth: JWT obtido (Bearer, expira em ~3600s).
[ OK ] Produtos: 50+ registro(s) de exemplo encontrados.
[ OK ] Parceiros: 50+ registro(s) de exemplo encontrados.

Resultado: OK — credenciais válidas e ambiente com dados para a demo.
```

### Opções

| Opção                | Descrição                                           |
| -------------------- | --------------------------------------------------- |
| `--dotenv <caminho>` | Arquivo `.env` a carregar (default: `./.env`).      |
| `--allow-production` | Permite validar contra produção (opt-in explícito). |
| `-h`, `--help`       | Ajuda.                                              |

> O ambiente real tem precedência sobre o `.env`: variáveis já exportadas não são
> sobrescritas. Para produção, use `--allow-production` (ou
> `SANKHYA_ALLOW_PRODUCTION=true`) — apenas após a demo.

### Códigos de saída

| Código | Significado                                                          |
| :----: | -------------------------------------------------------------------- |
|  `0`   | Tudo OK — credenciais válidas e há dados de exemplo.                 |
|  `1`   | Alguma checagem falhou (auth ou ausência de dados de exemplo).       |
|  `2`   | Erro de configuração/uso (credenciais ausentes, guarda de produção). |

## Troubleshooting

- **`Credenciais ausentes: ...`** → faltam variáveis no ambiente/`.env`.
- **Falha de autenticação (HTTP 401/403)** → revise `SANKHYA_CLIENT_ID`,
  `SANKHYA_CLIENT_SECRET` e `SANKHYA_X_TOKEN` (e confirme que são de sandbox).
- **`nenhum registro de exemplo encontrado`** → o sandbox autenticou, mas não há
  produtos/parceiros cadastrados; peça ao cliente dados de exemplo para a demo.

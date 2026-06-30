# Sankhya MCP

> Conjunto de servidores **MCP (Model Context Protocol)** que conectam agentes de IA
> ao ERP **Sankhya** através da sua [API pública](https://developer.sankhya.com.br/).

Monorepo open source (MIT) com um núcleo compartilhado e vários servidores MCP
divididos por **domínio funcional**. Cada servidor roda e é publicado de forma
independente — você carrega apenas os domínios que precisa, reduzindo o número de
tools no contexto do agente.

---

## ⚠️ Aviso de segurança (leia antes de usar)

Este é um projeto público. Leve a sério:

- **Credenciais ficam só no servidor**, em variáveis de ambiente. Nunca vão para o
  contexto do LLM, logs ou mensagens de erro (há redação automática de segredos).
- **Default é `sandbox`.** Produção exige opt-in explícito (`SANKHYA_ENV=production`).
- **Escrita é protegida:** há um modo `read-only` global e um modo `dry-run` que
  mostra o payload que _seria_ enviado sem executar.
- **SQL livre (`DbExplorerSP.executeQuery`) é desabilitado por padrão.** Habilite só
  com plena consciência dos riscos (`SANKHYA_ALLOW_RAW_SQL=true`).
- Nunca commite `.env` com credenciais reais.

---

## Arquitetura

```
sankhya-mcp/
├── packages/
│   ├── core/                 # auth OAuth, HTTP client, gestão/cache de token,
│   │                         # helpers de payload, erros tipados, redação de segredos
│   └── data-dictionary/      # entidades, campos, PKs, mapeamento tabela↔entidade
├── servers/
│   ├── mcp-core/             # tools genéricas + resources do dicionário (REFERÊNCIA)
│   ├── mcp-vendas/           # pedidos, NF-e/NFC-e, CF-e/SAT, caixa, preços, sugestões
│   ├── mcp-financeiro/       # cadastros e movimentos financeiros, baixas, contas
│   ├── mcp-suprimentos/      # produtos, estoque
│   ├── mcp-rh/               # HCM: funcionários, admissão, cadastros de pessoal
│   └── mcp-cadastros/        # clientes, contatos, naturezas, centros de resultado
├── examples/                 # configs de cliente MCP e docker-compose
└── ...                       # turbo, tsconfig base, eslint/prettier, etc.
```

**Stack:** TypeScript estrito (ESM/NodeNext), [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol),
pnpm workspaces + Turborepo, zod, vitest, ESLint + Prettier.

### Estratégia de tools (importante)

Em vez de mapear **1 endpoint = 1 tool** (o que explodiria o contexto), usamos:

- **Tools genéricas** com a entidade/serviço como **parâmetro** — `query_entity`,
  `load_record`, `save_record` cobrem centenas de endpoints de leitura/escrita.
- **Tools de negócio** com semântica própria, onde há regras (ex.: incluir nota,
  faturar pedido, baixar título) — implementadas nos servidores de domínio.
- **Resources** para descoberta de schema (dicionário de dados), em vez de virar tools.

### Como a API Sankhya funciona (resumo)

- **Auth:** OAuth 2.0 Client Credentials. `POST /authenticate` com `client_id` +
  `client_secret` (form) + header `X-Token`, `grant_type=client_credentials`. Retorna
  um JWT usado como `Authorization: Bearer`. O `core` cacheia e renova o token
  automaticamente antes de expirar.
- **Ambientes:** Produção `https://api.sankhya.com.br/` e Sandbox
  `https://api.sandbox.sankhya.com.br/` (credenciais/tokens independentes).
- **Serviços genéricos via Gateway:**
  `…/gateway/v1/{modulo}/service.sbr?serviceName={servico}&outputType=json`.
  Principais: `CRUDServiceProvider.loadRecords` / `loadRecord` / `saveRecord`
  (upsert pela PK — a API não usa PUT) e `DbExplorerSP.executeQuery`.
- **Módulos:** `mge` (cadastros/dados gerais) e `mgecom` (movimentações comerciais).
  Serviços são **exclusivos** de cada módulo.

> 📌 Muitos serviços/entidades nativos do ERP **não estão na doc oficial** (são
> descobertos via DevTools). Por isso o dicionário de dados é **extensível em
> runtime**: a comunidade registra novos mapeamentos via
> `@sankhya-mcp/data-dictionary` sem alterar o core. Veja `EntityRegistry`.

---

## Servidor de referência: `mcp-core`

| Tool            | O que faz                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `query_entity`  | Consulta múltipla (`loadRecords`) de qualquer entidade, com filtro tipado e paginação.         |
| `load_record`   | Carrega um registro único pela chave primária.                                                 |
| `save_record`   | Upsert (`saveRecord`): UPDATE se a PK existir, senão INSERT. Respeita `read-only` e `dry-run`. |
| `execute_query` | SQL livre (`DbExplorerSP.executeQuery`). **Só aparece** se `SANKHYA_ALLOW_RAW_SQL=true`.       |

| Resource                             | Conteúdo                                                         |
| ------------------------------------ | ---------------------------------------------------------------- |
| `sankhya://entities`                 | Lista de entidades conhecidas (entidade↔tabela, PK, doc).        |
| `sankhya://entities/{entity}/fields` | Campos conhecidos de uma entidade (lista parcial + link da doc). |

---

## Variáveis de ambiente

| Variável                     | Obrigatória | Default                   | Descrição                                              |
| ---------------------------- | :---------: | ------------------------- | ------------------------------------------------------ |
| `SANKHYA_CLIENT_ID`          |     ✅      | —                         | Client ID OAuth.                                       |
| `SANKHYA_CLIENT_SECRET`      |     ✅      | —                         | Client Secret OAuth.                                   |
| `SANKHYA_X_TOKEN`            |     ✅      | —                         | Token da aplicação (header `X-Token`).                 |
| `SANKHYA_ENV`                |      —      | `sandbox`                 | `sandbox` ou `production`. Produção exige opt-in.      |
| `SANKHYA_READ_ONLY`          |      —      | `false`                   | Bloqueia todas as operações de escrita.                |
| `SANKHYA_DRY_RUN`            |      —      | `false`                   | Escritas apenas mostram o payload (não executam).      |
| `SANKHYA_ALLOW_RAW_SQL`      |      —      | `false`                   | Habilita a tool `execute_query` (SQL livre, perigoso). |
| `SANKHYA_BASE_URL`           |      —      | derivada de `SANKHYA_ENV` | Sobrescreve a base URL (debug/proxy).                  |
| `SANKHYA_TOKEN_REFRESH_SKEW` |      —      | `60`                      | Folga (s) para renovar o token antes de expirar.       |
| `SANKHYA_HTTP_TIMEOUT`       |      —      | `30000`                   | Timeout das requisições HTTP (ms).                     |

Veja [`.env.example`](./.env.example).

---

## Começando

Requisitos: **Node ≥ 20** e **pnpm 10+**.

```bash
pnpm install
pnpm build      # compila todos os pacotes (Turborepo respeita as dependências)
pnpm test       # testes unitários (foco no core: auth e payloads)
pnpm lint       # ESLint
```

### Rodar um servidor isoladamente

Cada servidor é um executável MCP via **stdio**. Após `pnpm build`:

```bash
SANKHYA_CLIENT_ID=... \
SANKHYA_CLIENT_SECRET=... \
SANKHYA_X_TOKEN=... \
SANKHYA_ENV=sandbox \
node servers/mcp-core/dist/index.js
```

Os servidores publicados expõem binários (`sankhya-mcp-core`, `sankhya-mcp-vendas`, …),
então também podem ser iniciados via `npx @sankhya-mcp/mcp-core`.

### Conectar a um cliente MCP

Exemplo para Claude Desktop (carregando apenas os domínios desejados):

```jsonc
{
  "mcpServers": {
    "sankhya-core": {
      "command": "npx",
      "args": ["-y", "@sankhya-mcp/mcp-core"],
      "env": {
        "SANKHYA_CLIENT_ID": "...",
        "SANKHYA_CLIENT_SECRET": "...",
        "SANKHYA_X_TOKEN": "...",
        "SANKHYA_ENV": "sandbox",
      },
    },
  },
}
```

Mais exemplos (incluindo Docker e uso do build local) em [`examples/`](./examples).

### Docker

```bash
docker build -f servers/mcp-core/Dockerfile -t sankhya-mcp-core .
docker run --rm -i \
  -e SANKHYA_CLIENT_ID=... -e SANKHYA_CLIENT_SECRET=... -e SANKHYA_X_TOKEN=... \
  sankhya-mcp-core
```

---

## Pacote `@sankhya-mcp/core` (uso programático)

```ts
import { createRuntimeFromEnv } from '@sankhya-mcp/core';

const { client } = createRuntimeFromEnv();

const produtos = await client.loadRecords({
  entity: 'Produto',
  fields: ['CODPROD', 'DESCRPROD'],
  criteria: { expression: 'this.ATIVO = ?', parameters: [{ value: 'S' }] },
  offsetPage: 0,
});
```

---

## Contribuindo

- Commits semânticos (`feat:`, `fix:`, `docs:`…).
- Testes unitários no `core` são prioridade (auth e montagem de payloads).
- **Não invente campos/endpoints.** Onde faltar detalhe, deixe um `TODO` apontando
  para a doc (`https://developer.sankhya.com.br/reference/...`) e registre mapeamentos
  no `@sankhya-mcp/data-dictionary`.
- Como adicionar um servidor de domínio: use `servers/mcp-core` como molde
  (tools genéricas + resources) e os stubs de domínio como ponto de partida.

## Roadmap dos servidores de domínio

Os servidores de domínio são **esqueletos funcionais** com uma tool de exemplo cada,
prontos para receber as tools de negócio (cada `src/index.ts` lista seu roadmap):
incluir/faturar nota (vendas), baixar título (financeiro), ajustar estoque
(suprimentos), admitir funcionário (RH), incluir cliente/contato (cadastros), etc.

## Licença

[MIT](./LICENSE).

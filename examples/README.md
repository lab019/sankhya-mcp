# Exemplos de configuração

Arquivos de referência para conectar os servidores Sankhya MCP a clientes e ao Docker.

| Arquivo                      | Uso                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `claude_desktop_config.json` | Configuração de servidores MCP no Claude Desktop (e similar em outros clientes). |
| `docker-compose.yml`         | Build das imagens Docker de cada servidor e referência de variáveis de ambiente. |

> ⚠️ **Segurança:** nunca commite credenciais. Use `.env` (ignorado pelo git) ou os
> mecanismos de segredo do seu cliente/orquestrador. Comece sempre em `SANKHYA_ENV=sandbox`.

## Rodando localmente sem publicar (workspace)

Durante o desenvolvimento, em vez de `npx @sankhya-mcp/...`, aponte o cliente para o
build local:

```jsonc
{
  "mcpServers": {
    "sankhya-core": {
      "command": "node",
      "args": ["/caminho/para/sankhya-mcp/servers/mcp-core/dist/index.js"],
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

Lembre-se de rodar `pnpm build` antes.

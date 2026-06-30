# Dockerfile do servidor MCP Cadastros.
# Build a partir da RAIZ do monorepo:
#   docker build -f servers/mcp-cadastros/Dockerfile -t sankhya-mcp-cadastros .
#
# Credenciais NUNCA vão na imagem — passe via env em runtime.

# ---- Builder ----------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc turbo.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/data-dictionary/package.json packages/data-dictionary/
COPY servers/mcp-cadastros/package.json servers/mcp-cadastros/

RUN pnpm install --frozen-lockfile || pnpm install

COPY packages ./packages
COPY servers/mcp-cadastros ./servers/mcp-cadastros
RUN pnpm --filter @sankhya-mcp/core --filter @sankhya-mcp/data-dictionary --filter @sankhya-mcp/mcp-cadastros build
RUN pnpm --filter @sankhya-mcp/mcp-cadastros --prod deploy /app

# ---- Runtime ----------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV SANKHYA_ENV=sandbox
COPY --from=builder /app ./
USER node
ENTRYPOINT ["node", "dist/index.js"]

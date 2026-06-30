# Dockerfile do servidor MCP Core.
# Build a partir da RAIZ do monorepo:
#   docker build -f servers/mcp-core/Dockerfile -t sankhya-mcp-core .
#
# Credenciais NUNCA vão na imagem — passe via env em runtime:
#   docker run --rm -i \
#     -e SANKHYA_CLIENT_ID=... -e SANKHYA_CLIENT_SECRET=... -e SANKHYA_X_TOKEN=... \
#     sankhya-mcp-core

# ---- Builder ----------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /repo

RUN corepack enable

# Manifests primeiro (cache de dependências).
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc turbo.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/data-dictionary/package.json packages/data-dictionary/
COPY servers/mcp-core/package.json servers/mcp-core/

RUN pnpm install --frozen-lockfile || pnpm install

# Código-fonte e build.
COPY packages ./packages
COPY servers/mcp-core ./servers/mcp-core
RUN pnpm --filter @sankhya-mcp/core --filter @sankhya-mcp/data-dictionary --filter @sankhya-mcp/mcp-core build

# Remove devDependencies para a imagem final.
RUN pnpm --filter @sankhya-mcp/mcp-core --prod deploy /app

# ---- Runtime ----------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Default seguro: sandbox.
ENV SANKHYA_ENV=sandbox

COPY --from=builder /app ./

# Roda como usuário não-root.
USER node

ENTRYPOINT ["node", "dist/index.js"]

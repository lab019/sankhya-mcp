# Dockerfile do servidor MCP RH (HCM).
# Build a partir da RAIZ do monorepo:
#   docker build -f servers/mcp-rh/Dockerfile -t sankhya-mcp-rh .
#
# Credenciais NUNCA vão na imagem — passe via env em runtime.

# ---- Builder ----------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc turbo.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/data-dictionary/package.json packages/data-dictionary/
COPY servers/mcp-rh/package.json servers/mcp-rh/

RUN pnpm install --frozen-lockfile || pnpm install

COPY packages ./packages
COPY servers/mcp-rh ./servers/mcp-rh
RUN pnpm --filter @sankhya-mcp/core --filter @sankhya-mcp/data-dictionary --filter @sankhya-mcp/mcp-rh build
RUN pnpm --filter @sankhya-mcp/mcp-rh --prod deploy /app

# ---- Runtime ----------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV SANKHYA_ENV=sandbox
COPY --from=builder /app ./
USER node
ENTRYPOINT ["node", "dist/index.js"]

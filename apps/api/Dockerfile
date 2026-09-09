# syntax=docker/dockerfile:1.7
# ------------------------------------------------------------------------------
# Autonomous Enterprise API (NestJS) - multi-stage build for the pnpm workspace.
#
# The runtime image reuses the dependency tree produced by the build stage
# because `packages/database` runs `prisma generate`, which writes the generated
# client into node_modules. Re-installing with --prod --ignore-scripts would
# drop that generated client and break DATABASE_DRIVER=postgres.
# ------------------------------------------------------------------------------

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# ------------------------------------------------------------------------------
# deps: install the workspace dependency graph from the lockfile only, so this
# layer is cached until a manifest or the lockfile actually changes.
# ------------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/shared/package.json packages/shared/
COPY packages/database/package.json packages/database/
COPY packages/benchmark/package.json packages/benchmark/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ------------------------------------------------------------------------------
# build: generate the Prisma client and compile every workspace package the API
# depends on, in dependency order.
# ------------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /repo/ ./
COPY tsconfig.json ./
COPY prisma ./prisma
COPY packages/contracts ./packages/contracts
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY apps/api ./apps/api
RUN pnpm --filter @autonomous-enterprise/contracts build \
 && pnpm --filter @autonomous-enterprise/shared build \
 && pnpm --filter @autonomous-enterprise/database build \
 && pnpm --filter @autonomous-enterprise/api build \
 && rm -rf apps/api/test apps/api/src packages/*/src packages/*/test

# Drop the pnpm content-addressable store, which is pure build cache and would
# otherwise double the size of the copied dependency tree.
#
# Dev dependencies are deliberately NOT pruned here: `pnpm prune --prod` removes
# the per-package node_modules symlink farm (apps/api/node_modules), which
# breaks module resolution at runtime, and a fresh `--prod` install would
# discard the Prisma client generated during the build. Image size is traded for
# a runtime that is known to work.
RUN rm -rf /root/.cache /root/.local/share/pnpm/store

# ------------------------------------------------------------------------------
# runtime
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runtime
RUN apk add --no-cache curl tini
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /repo

COPY --from=build --chown=node:node /repo/ ./
COPY --chown=node:node apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node
WORKDIR /repo/apps/api
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=6 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

# tini reaps zombies; the entrypoint script applies migrations before exec'ing
# the server, so the process the orchestrator supervises is still node itself.
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]

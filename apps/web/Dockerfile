# syntax=docker/dockerfile:1.7
# ------------------------------------------------------------------------------
# Autonomous Enterprise Web (SvelteKit, adapter-static SPA) served by nginx.
# ------------------------------------------------------------------------------

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# ------------------------------------------------------------------------------
# deps
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
    pnpm install --frozen-lockfile --ignore-scripts

# ------------------------------------------------------------------------------
# build: produce the static bundle in apps/web/build
# ------------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /repo/ ./
COPY tsconfig.json ./
COPY apps/web ./apps/web
RUN pnpm --filter @autonomous-enterprise/web build

# ------------------------------------------------------------------------------
# runtime: nginx serving the SPA. The API base URL is injected at container
# start into /runtime-config.js so one image works across environments.
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
ENV PUBLIC_API_BASE_URL=/api/v1

COPY --from=build /repo/apps/web/build /usr/share/nginx/html
COPY infrastructure/nginx/web.conf /etc/nginx/conf.d/default.conf
COPY infrastructure/nginx/docker-entrypoint.d/10-runtime-config.sh /docker-entrypoint.d/10-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/10-runtime-config.sh

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1

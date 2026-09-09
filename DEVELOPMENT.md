# Development Guide

## Current repository state

The repository has been scaffolded with pnpm workspaces + Turborepo monorepo configuration.

### Toolchain Commands

- **Setup / Install:** `pnpm install`
- **Development:** `pnpm dev`
- **Build:** `pnpm build`
- **Lint:** `pnpm lint`
- **Typecheck:** `pnpm typecheck`
- **Test:** `pnpm test`

### Infrastructure Setup & Verification

- **Environment Setup:** `cp .env.example .env`
- **Start Services (Docker Compose):** `docker compose up -d`
- **Stop Services (Docker Compose):** `docker compose down`
- **Verify Services (Docker Compose):** `docker compose ps`
- **Create Kind Cluster:** `kind create cluster --config infrastructure/kind/kind-config.yaml`
- **Apply Kubernetes Manifests:** `kubectl apply -f infrastructure/kubernetes/`
- **Verify Kubernetes Deployment:** `kubectl get pods -n autonomous-enterprise`

### Containerised stack behind the nginx API gateway

The whole platform runs in Docker, with nginx as the single public entrypoint:

```
browser ──► gateway (nginx, :80)
              ├── /            ──► web       (SvelteKit static SPA on nginx)
              ├── /api/        ──► api       (NestJS)
              ├── /api/v1/events/stream ──► api (SSE, buffering disabled)
              └── /auth/       ──► keycloak
```

- **Build images:** `docker compose build api web`
- **Start everything:** `docker compose up -d`
- **Start without Keycloak:** `docker compose up -d postgres redis api web gateway`
- **Open the UI:** <http://localhost/> (override with `GATEWAY_PORT`, e.g. `GATEWAY_PORT=8088 docker compose up -d`)
- **Gateway self-check:** `curl http://localhost/gateway/health`
- **API health via gateway:** `curl http://localhost/api/health`
- **Tail gateway access log:** `docker compose logs -f gateway`

Because the browser only ever talks to the gateway, every request is same-origin
and CORS is not involved. The SPA reads its API base URL at runtime from
`/runtime-config.js`, which the web container regenerates on each start from
`PUBLIC_API_BASE_URL`; the same image can therefore be promoted between
environments without a rebuild.

`NODE_ENV` defaults to `development` for the composed API on purpose: with
`NODE_ENV=production`, `TenantGuard` rejects every request that has no bearer
token, so the UI would return 401 until a Keycloak realm is configured.

Keycloak runs with `KC_HTTP_RELATIVE_PATH=/auth` so the issuer and redirect URLs
it generates already contain the gateway prefix and stay valid behind the proxy.

### Connecting the API to a local Kind cluster

Without this the Infrastructure module cannot reach Kubernetes and `infra-agent`
reports `[NO DATA] cluster snapshot failed`, because the kubeconfig on the host
points at `https://127.0.0.1:<random-port>` — an address that, inside a
container, resolves to the container itself.

```bash
kind create cluster --config infrastructure/kind/kind-config.yaml
kubectl apply -f infrastructure/kubernetes/00-namespace.yaml \
               -f infrastructure/kubernetes/06-sample-workload.yaml
./infrastructure/kind/generate-internal-kubeconfig.sh
docker compose -f docker-compose.yml -f docker-compose.kind.yml up -d
```

The generator rewrites the API server address to the control-plane's DNS name on
Docker's `kind` network, and the overlay attaches the API container to that
network. The Kind API server certificate already lists that name in its SANs, so
TLS verification succeeds without any insecure flag.

Verify:

```bash
curl -H 'x-actor-id: dev' -H 'x-actor-roles: ADMIN,TENANT_ADMIN' -H 'x-actor-permissions: *' \
  'http://localhost:8088/api/v1/infrastructure/cluster-snapshot?namespace=autonomous-enterprise'
```

`K8S_NAMESPACE` must match the namespace the workload is deployed into
(`autonomous-enterprise`); pointing it at `default` returns an empty deployment
list and leaves the agent with nothing to scale.

The base `docker-compose.yml` stays runnable on a machine with no Kubernetes at
all — the Kind wiring is a separate, optional overlay.

### AI provider from inside a container

`API_URL_AI_PROVIDER` in `.env` uses `localhost`, which inside a container means
the container itself. Set `API_URL_AI_PROVIDER_CONTAINER` (already defaulted to
`http://host.docker.internal:20128/v1`) when the provider runs on the host;
compose maps `host.docker.internal` via `extra_hosts`. Without it every agent
logs `AI provider is not configured` and takes no autonomous action.

Free-tier models are easily rate limited. For load-related testing, run the
simulator with `autoAiReasoning: false` (narration is cosmetic) or set
`SIMULATOR_AGENT_MODE=false` to use the deterministic scripted scenarios.

### Persistence

The stack defaults to `DATABASE_DRIVER=prisma`, so everything written through
the API is persisted to PostgreSQL and survives an API restart. Set
`DATABASE_DRIVER=in-memory` to run with no database, at the cost of losing all
data whenever the API restarts.

The API container applies pending migrations on start
(`apps/api/docker-entrypoint.sh`), so a fresh database needs no manual step. The
migration is retried for a short while because PostgreSQL accepts connections
before it is ready to serve them.

Note on migration history: the seven original migrations each created
`tenant_id` columns. After multi-tenancy was removed they were replaced by a
single `20260905000000_init_single_enterprise` baseline generated from the
current schema, so a fresh database no longer creates and then drops 42 unused
columns. An existing database must be reset rather than migrated forward.

### Database Commands (Prisma & PostgreSQL)

- **Generate Prisma Client:** `pnpm --filter @autonomous-enterprise/database db:generate`
- **Push Schema Changes to DB:** `pnpm --filter @autonomous-enterprise/database db:push`
- **Run Database Migrations:** `npx prisma migrate deploy --schema=prisma/schema.prisma` (requires `DATABASE_URL`)
- **Seed Minimal Database:** `npx tsx prisma/seed.ts` (requires `DATABASE_URL`)

Note: `postgres` hosts two separate databases — `POSTGRES_DB` (application data, Prisma-managed) and `KEYCLOAK_DB` (Keycloak's own schema). They must never share a database; `infrastructure/docker/postgres-init/01-create-keycloak-db.sh` creates the second database automatically on first container startup.

### Running the API against real infrastructure

By default the API uses in-memory repositories and does not require Docker. To run against PostgreSQL:

1. `docker compose up -d postgres redis kafka keycloak`
2. Export `DATABASE_URL` built from your `.env` Postgres values, then run `npx prisma migrate deploy --schema=prisma/schema.prisma` and `npx tsx prisma/seed.ts`.
3. Start the API with `DATABASE_DRIVER=prisma` set in the environment (in addition to `DATABASE_URL`). `AUTH_BYPASS_HEADER_TRUST=true` is required for local testing without a real Keycloak-issued JWT.

Verified locally: full order-fulfillment vertical slice (create sales order -> validate -> check inventory -> reserve stock -> fulfilled) works end-to-end against real PostgreSQL, with tenant isolation confirmed across two tenants.

## Implementation order

For each feature:

1. Confirm the requirement and boundary in `PRD.md` and `ARCHITECTURE.md`.
2. Define the data owner and tenant scope.
3. Define the API, event, authorization, policy, and audit behavior.
4. Implement deterministic business logic first.
5. Add AI orchestration only where reasoning or coordination is necessary.
6. Add focused tests and operational observability.
7. Run the repository's documented formatter, lint, typecheck, and tests once those commands exist.

## Code organization

When executable code is introduced, preserve explicit boundaries for business modules and platform services. Prefer a structure that makes ownership obvious rather than a shared catch-all domain layer. Keep module persistence private and expose cross-module behavior through contracts.

Shared libraries may contain technical primitives such as identity context, event schemas, audit types, and policy interfaces, but must not become an unreviewed shared store for business rules.

## Data and contracts

- Include `tenant_id` in every tenant-owned aggregate and enforce it at every read and write boundary.
- Keep migrations versioned and owned by the service whose data they change.
- Version external APIs and event schemas.
- Make handlers idempotent where retries are possible.
- Validate agent payloads and authorization before invoking tools or mutating state.
- Store structured workflow state rather than relying on conversation transcripts.

## AI-specific rules

- Use deterministic APIs for simple reads and checks before considering an agent.
- Keep policy evaluation outside the LLM.
- Give each agent an explicit identity and least-privilege permission set.
- Enforce max iterations, token budget, time budget, and minimum confidence.
- Record model, token usage, latency, trust, confidence, tool calls, policy result, and execution result.
- Stop and escalate when the circuit breaker conditions are met; do not retry indefinitely.
- Treat RAG as supporting evidence, not as the system of record. Restrict retrieval by tenant.

## Testing expectations

As implementation begins, add tests at the owning boundary:

- Unit tests for domain rules and policy decisions.
- API contract tests for module endpoints.
- Event contract and idempotency tests.
- Integration tests for tenant isolation and RBAC.
- Workflow tests for approval, bounded re-evaluation, circuit breaking, and escalation.
- Infrastructure integration tests only where Kubernetes behavior cannot be represented by deterministic unit tests.

Document required services, fixtures, seed data, snapshots, and expensive or flaky suites here when they become known.

## Documentation maintenance

Update `ARCHITECTURE.md` when ownership or contracts change, `ROADMAP.md` when scope/order changes, and this file when commands or engineering conventions change. Keep `PRD.md` focused on product requirements rather than implementation trivia.

## Final Stack & Tooling Decisions

- **Runtime & Monorepo:** TypeScript / Node.js with pnpm + Turborepo.
- **Backend & Frontend:** NestJS for modular backend services, SvelteKit for frontend applications.
- **Database & Cache:** PostgreSQL + Redis.
- **APIs & Schema Strategy:** OpenAPI-first for REST APIs, Protobuf for gRPC service communication.
- **Messaging:** Transactional Outbox pattern with Apache Kafka for reliable event distribution.
- **Identity & Access:** Keycloak for tenant identity and authentication.
- **Local Infrastructure:** Docker Compose + Kind (Kubernetes in Docker).
- **Testing:** Vitest + Testcontainers.
- **AI Integration:** LLM/Model provider abstraction via OmniRouter.

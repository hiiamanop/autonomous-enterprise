# Operations Runbook

This document covers backup, disaster recovery, secrets management, key rotation, and day-to-day operational procedures for the Autonomous Enterprise Platform. It complements `DEVELOPMENT.md` (local setup) and `ARCHITECTURE.md` (system design).

## Health, metrics, and logging

- **Liveness/basic health:** `GET /api/v1/health` (public, no tenant context required).
- **Three-layer observability snapshot:** `GET /api/v1/observability/snapshot` (requires `observability:read` permission). Returns:
  - **Business layer:** total audit events, breakdown by action type, success/failure counts.
  - **AI layer:** registered agent count, average trust score, AI call count, token usage, budget-exceeded count, circuit-breaker trigger count, escalation count.
  - **Infrastructure layer:** scaling event counts by outcome (executed, rejected, escalated, failed).
- **Structured audit trail:** every autonomous and human-triggered action is recorded via `AuditService` with actor, tenant, action, input/output, and status (`SUCCESS`/`FAILURE`/`REJECTED`). Audit records are the primary log surface; application logs (`Logger`) are reserved for operational diagnostics (unhandled exceptions, Kubernetes connectivity, etc.), not business events.
- **Rate limiting:** a global `ThrottlerGuard` limits each client to 300 requests per 60 seconds by default (`apps/api/src/app.module.ts`). Tune via `ThrottlerModule.forRoot(...)` if a tenant's legitimate traffic exceeds this.

## Autoscaling policy (infrastructure agent)

Capacity decisions are made by `planCapacity` in `apps/api/src/modules/simulator/capacity-planner.ts`, kept as a pure function so the policy is testable without a cluster or an LLM (`apps/api/test/capacity-planner.test.ts`).

- **Signal is arrival rate, not backlog size.** Replica count is derived from orders per minute (`ordersPerMinuteFrom`, a 60-second window over persisted order timestamps), plus backlog spread over five minutes as secondary pressure. A shopping event is defined by how fast orders arrive, not by how many are queued at one instant.
- **One replica absorbs 12 orders/minute** (`ORDERS_PER_MINUTE_PER_REPLICA`), chosen to be comparable to the warehouse capacity model in `HrisService`. Bounds are 2–10 replicas.
- **Scale-up jumps straight to target.** The earlier policy incremented by one replica per tick, so reaching 10 from 2 took eight ticks and the surge was absorbed by an under-provisioned cluster. Verified on Kind: a 120-order burst produced a single `2 -> 10` event.
- **Flash-sale headroom is 1.5x.** In `FLASH_SALE` mode capacity is provisioned ahead of observed demand, because arrival rate climbs faster than the reconciliation loop can react.
- **Scale-down has 60% hysteresis.** Capacity is only released once load falls below 60% of what the current footprint supports, to avoid oscillating around the threshold. Verified: `10 -> 2` once the surge drained, then `2 -> 3` as backlog was worked off.
- **Cost is the target footprint, not the delta** (`REPLICA_HOURLY_COST_USD` = $0.012/replica/hour), and is passed to `requestScaling` for the Finance budget gate. Refusals surface as a scaling-event status (`POLICY_REJECTED`), not an exception, so the event log records why capacity was withheld.

Operational note: `requestScaling` reports policy and budget refusals through the event status rather than by throwing. Any caller that only catches exceptions will silently treat a rejected scale-up as a success.

## nginx API gateway

The gateway (`infrastructure/nginx/gateway.conf`) is the single public entrypoint. It terminates client connections and routes to three upstreams: `/` to the web SPA, `/api/` to the NestJS API, and `/auth/` to Keycloak.

- **Gateway-only health:** `GET /gateway/health` returns `{"status":"ok","component":"gateway"}` without contacting any upstream, so an operator can distinguish "gateway down" from "upstream down". Compare against `GET /api/health`, which proxies through to the API.
- **Access log:** the `ae_gateway` format records upstream address, status, `$request_time`, `$upstream_response_time`, and `$request_id`. The same request ID is forwarded upstream as `X-Request-Id` and echoed to the client, so a browser network trace can be correlated with API audit records.
- **Outer rate limit:** 30 req/s per client IP with a burst of 60 (`limit_req_zone ae_api_rate`), plus a 64-connection cap per IP. This is a coarse guard in front of the API's own 300 req/min throttle; a client exceeding it receives `429`.
- **SSE:** `/api/v1/events/stream` has its own location with `proxy_buffering off`, `gzip off`, and 24-hour read/send timeouts. Without these, nginx buffers the event stream and the live dashboard appears frozen. If events stop arriving, verify this location has not been shadowed by the generic `/api/` block.
- **Upstream DNS:** upstreams are resolved at request time via the container DNS resolver (`resolver 127.0.0.11`) rather than at startup. This keeps the gateway bootable when an optional upstream such as Keycloak is not running, and prevents a stale IP being cached after a container is recreated.
- **Proxy headers:** every location includes `infrastructure/nginx/snippets/proxy-common.conf`. Any location that sets its own `proxy_set_header` discards all inherited ones, so header changes must be made in that snippet — not in the server block — or `Host` and `X-Forwarded-*` will silently disappear for that route.
- **Keycloak behind the proxy:** Keycloak runs with `KC_HTTP_RELATIVE_PATH=/auth` and `KC_PROXY_HEADERS=xforwarded`. The gateway forwards `$http_host` (not `$host`) so a non-standard public port is preserved in the issuer and redirect URLs it generates. Verify after any change: `curl -s http://<host>/auth/realms/master/.well-known/openid-configuration` must report an `issuer` matching the public address clients use.
- **Config changes:** `gateway.conf` and the snippets are bind-mounted read-only, so `docker compose restart gateway` is enough to apply an edit. Validate first with `docker compose exec gateway nginx -t`, then reload without dropping connections via `docker compose exec gateway nginx -s reload`.

## Secret management

- No secret is ever read directly by the agent/assistant maintaining this repository; only `.env.example` (variable names, placeholder values) is version-controlled. The actual `.env` file must stay untracked (already covered by `.gitignore`).
- Required secrets: `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `KEYCLOAK_ADMIN_PASSWORD`, `KEYCLOAK_SECRET`, `OMNIROUTER_API_KEY` (or `PROVIDER_API_KEY`).
- **Local development:** secrets live in `.env`, consumed via `docker compose` env files and process environment variables.
- **Kubernetes (local kind or cloud):** secrets must be provisioned as native `Secret` resources (see `infrastructure/kubernetes/01-configmap-secrets.yaml` for the shape) — never baked into container images or committed manifests. For cloud deployment, prefer a managed secret store (e.g., cloud KMS-backed secret manager) with the Kubernetes `Secret` populated via an external-secrets operator rather than `kubectl apply` of plaintext.
- The `OmniRouterClient` (`apps/api/src/common/ai-provider/omnirouter.client.ts`) never logs the API key; the `GlobalExceptionFilter` sanitizes all error responses returned to clients so stack traces and internal error detail never reach the caller.

## Key rotation

- **Keycloak JWT signing keys:** rotate via Keycloak's realm key provider rotation (generate a new active key, keep the old key as passive until all outstanding tokens expire, then remove it). `KeycloakJwtService` (`apps/api/src/common/auth/keycloak-jwt.service.ts`) fetches signing keys from the JWKS endpoint (`KEYCLOAK_JWKS_URI`) and does not cache keys beyond the configured TTL, so rotation does not require an API redeploy.
- **AI provider API key (`OMNIROUTER_API_KEY`/`PROVIDER_API_KEY`):** rotate at the provider, update the Kubernetes `Secret` (or `.env` locally), and restart the API deployment to pick up the new value — the key is read once at request time from `process.env`, so a rolling restart is sufficient.
- **Database credentials:** rotate `POSTGRES_PASSWORD` via the managed Postgres provider (cloud) or by updating the container's environment and restarting `postgres` + dependent services (local). Because `DATABASE_URL` is derived from `POSTGRES_*` env vars at process start, every service that holds a Postgres connection must be restarted after rotation.
- Rotation cadence: production secrets should be rotated at minimum every 90 days, or immediately upon suspected compromise, consistent with `PRD.md` section 48 security requirements.

## Backup

- **PostgreSQL (system of record for Sales, Inventory, Procurement, Finance, Accounting, HRIS, Ticketing, AI orchestration state):**
  - Local: `docker exec ae-postgres pg_dump -U <POSTGRES_USER> <POSTGRES_DB> > backup.sql` for ad-hoc snapshots.
  - Production target: automated point-in-time recovery (PITR) via the managed cloud Postgres offering (e.g., continuous WAL archiving), with daily full snapshots retained for at least 30 days.
- **Prisma migrations** (`prisma/migrations/`) are the source of truth for schema; never hand-edit the database schema outside a migration.
- **In-memory-only data** (documented known limitation, see `ROADMAP.md`): `AuditService` and parts of `TicketingService`'s legacy in-memory path do not survive process restarts in the default (non-Prisma) driver mode. Any tenant relying on audit-trail durability must run with `DATABASE_DRIVER=prisma`.
- **Kubernetes cluster state** (Phase 6 Infrastructure module): live cluster inventory (nodes/pods/deployments/services) is not backed up — it is observed live from the Kubernetes API on every request and is inherently reconstructable from cluster manifests. Only the `ScalingEvent` and `CloudCostRecord` audit trail is persisted in Postgres and must be included in the Postgres backup scope.

## Disaster recovery

1. **Database loss:** restore the latest Postgres snapshot/PITR checkpoint, then run `npx prisma migrate deploy --schema=prisma/schema.prisma` to confirm the schema matches the current migration history before resuming traffic.
2. **Kubernetes cluster loss (infrastructure layer only):** re-provision via `kind create cluster --config infrastructure/kind/kind-config.yaml` (local) or the equivalent cloud Kubernetes cluster creation, then re-apply `infrastructure/kubernetes/*.yaml`. Because live cluster state is not the system of record, this does not cause data loss for business data — only a temporary infrastructure-observability and scaling-control gap until the cluster is back.
3. **Full environment loss:** rebuild in order — (a) Kubernetes cluster, (b) PostgreSQL from latest backup, (c) Redis/Kafka/Keycloak (stateless from the platform's perspective, reprovision fresh; Keycloak realm configuration should be exported/imported via its own realm-export JSON, not covered by Postgres backup since it lives in `KEYCLOAK_DB`), (d) deploy the API, (e) run `pnpm build` and full verification (`pnpm lint && pnpm typecheck && pnpm test && pnpm build`) before serving traffic.
4. **Tenant-scoped incident (single tenant's data corrupted, others unaffected):** because every table enforces `tenantId`, a tenant-scoped restore can be performed by restoring the full database to a recovery instance and selectively re-inserting only that tenant's rows — this is a manual, audited procedure and should itself be recorded as an audit event with `action: 'TENANT_DATA_RECOVERY'` once implemented (not yet automated).

## AI budget and circuit-breaker operational notes

- The AI Cognitive Budget Manager (`AiBudgetService`) now serializes budget check + usage recording per tenant via a Redis-backed distributed lock (`reserveAndRecordUsage`, `apps/api/src/modules/ai-budget/ai-budget.service.ts`) when `REDIS_ENABLED=true`. If Redis is disabled or unreachable, the service falls back to unlocked check-then-write behavior — acceptable for local/single-replica development, but **Redis must be enabled (`REDIS_ENABLED=true`) in any multi-replica or production deployment** to prevent budget overrun under concurrent load.
- Circuit breaker state (`WorkflowTaskService`) persists to Postgres and creates a ticket before escalating to a human, per PRD section 17 — verify `DATABASE_DRIVER=prisma` is set in production so this state survives restarts.

## Portability to cloud Kubernetes

- The platform was built and verified against a local `kind` cluster (`infrastructure/kind/kind-config.yaml`) using the same Kubernetes API (`@kubernetes/client-node`) that any standard-conformant cloud Kubernetes offering exposes. Portability checklist before moving to a cloud target:
  1. Point `KUBECONFIG_PATH` (or in-cluster service-account config, if the API itself runs inside the target cluster) at the cloud cluster's kubeconfig.
  2. Replace `infrastructure/kubernetes/*.yaml` `ClusterIP` services with the cloud provider's ingress/load-balancer equivalents where external access is required.
  3. Move secrets from local `Secret` manifests to the cloud provider's managed secret store integration.
  4. Re-run the same `InfrastructureService.requestScaling` flow against the cloud cluster's sample workload to confirm the observe → reason → policy → execute → audit path still functions identically — no code changes should be required since the Infrastructure module only depends on the standard Kubernetes API, not any local-only kind feature.
  5. Update `CloudCostRecord` ingestion (currently manual/unimplemented — see `ROADMAP.md` known limitations) to the cloud provider's billing API once available.

## Known operational limitations (tracked, not yet resolved)

- `AiBudgetService` uses a Redis distributed lock for the reserve+record path, but not yet for every legacy caller of `checkBudgetAvailability`/`recordUsage` used independently outside `OrchestratorService` — any new caller should prefer `reserveAndRecordUsage` for atomicity.
- Several modules record the same business event both via a manual `AuditService.record(...)` call inside the service method and via the `@Audit(...)` decorator's `AuditInterceptor` on the controller, resulting in duplicate audit rows for a single logical action (observed for `CREATE_DEPARTMENT` and likely others). This does not cause incorrect business state, but inflates audit event counts in the observability snapshot. Deduplicating this (removing the manual `AuditService.record` call where the controller-level `@Audit` decorator already covers the same action) is deferred as a follow-up cleanup.
- Infrastructure scaling `confidence` is a fixed placeholder (0.8), not derived from real Prometheus/metrics signals — see `ROADMAP.md` Phase 6 known limitation.
- Knowledge/RAG retrieval uses keyword term-frequency scoring, not vector/embedding search — deferred to the Phase 8 Research Testbed.

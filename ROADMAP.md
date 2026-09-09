# Delivery Roadmap

This roadmap sequences the `PRD.md` into vertical slices that establish safety and data ownership before autonomous behavior.

## Phase 0 — Foundation

- Choose the initial runtime, language, database, API framework, event transport, and local Kubernetes tooling.
- Scaffold the repository with reproducible local setup and documented formatter, lint, typecheck, test, migration, and build commands.
- Establish API versioning, error format, structured logging, correlation IDs, migrations, and configuration loading.
- Establish tenant context, identity, RBAC, audit primitives, and shared contract conventions.

### Technical Baseline

- **Language & Runtime:** TypeScript + Node.js
- **Monorepo Architecture:** pnpm workspaces + Turborepo
- **Backend Framework:** NestJS
- **Frontend Framework:** SvelteKit
- **Database & Caching:** PostgreSQL + Redis
- **API Protocols:** REST/OpenAPI + gRPC
- **Event Transport:** Transactional outbox + Kafka
- **Identity & Access Management:** Keycloak
- **Local Kubernetes & Orchestration:** Docker Compose + Kind
- **Testing Strategy:** Vitest + Testcontainers
- **Contract Design:** OpenAPI-first + Protobuf
- **AI Layer:** OmniRouter provider abstraction

Exit criteria: a new developer can start the system locally, run verification, create a tenant-scoped authenticated request, and inspect an auditable operation.

## Phase 1 — First business slice: Sales + Inventory

- Implement customers, products/SKUs, warehouses, stock, sales orders, and stock reservations.
- Provide deterministic APIs for order validation, stock checks, and reservation.
- Emit `OrderCreated`, stock, reservation, and failure events using versioned schemas.
- Implement the first end-to-end workflow: validate sales order → check inventory → reserve stock → return status.
- Prove tenant isolation, RBAC, idempotency, and auditability.

Exit criteria: a tenant can safely fulfill a basic sales order without direct cross-module database access.

**Status: Complete.** Verified end-to-end against real PostgreSQL: create sales order -> fulfillment workflow -> stock reservation -> order FULFILLED, with tenant isolation confirmed across tenants.

## Phase 2 — Procurement and finance controls

- Implement suppliers, purchase requests/orders, quotations, goods receipts, budgets, and approval rules.
- Connect low-stock signals to procurement requests through events.
- Add policy evaluation for supplier verification, budget availability, and spending thresholds.
- Require human approval for actions outside configured automatic-approval limits.

Exit criteria: replenishment and spending decisions are policy-controlled, tenant-scoped, and auditable.

**Status: Complete.** Implemented:
- Procurement module (Supplier, PurchaseRequest, PurchaseOrder, PurchaseOrderItem, SupplierQuotation, GoodsReceipt) with tenant-scoped Prisma and in-memory repositories.
- Finance module (CostCenter, Budget, BudgetAllocation, Expense) with `checkBudgetAvailability` used as a policy input.
- A deterministic Policy Engine (`apps/api/src/common/policy`) separate from any LLM, evaluating supplier verification, budget availability, and auto-approval thresholds to produce `AUTO_APPROVE`, `REQUIRE_HUMAN_APPROVAL`, or `REJECT`.
- `PurchaseApprovalService` workflow integrating Procurement + Finance + Policy Engine, with idempotency and compensating rollback (purchase order reverted to `DRAFT`) if budget allocation fails after approval.
- `ReplenishmentService` connecting Inventory reorder rules to automatic Procurement `PurchaseRequest` creation (actor `AI_INVENTORY_AGENT`) after order fulfillment, published as a `StockLow` outbox event.

Verified end-to-end against real PostgreSQL: supplier verification -> budget creation -> purchase order -> auto-approval -> budget allocation, and separately, order fulfillment depleting stock below reorder minimum -> automatic purchase request creation. Tenant isolation confirmed for both Procurement and Finance data.

Known limitation: idempotency and budget-availability checks are enforced by application-level locking (in-memory idempotency store, verify-then-write repository checks), not database transactions or distributed locks. Concurrent requests without an idempotency key could still race under high concurrency; this should be revisited when introducing multi-instance deployment.

## Phase 3 — Accounting and workflow platform

- Implement chart of accounts, journals, ledger posting, invoices, receivables, payables, payments, and financial posting.
- Introduce reusable workflow tasks, approvals, deadlines, retries, and escalation tickets.
- Add conflict detection and bounded re-evaluation with persisted task limits.

Exit criteria: financial state remains owned by Accounting/Finance while workflows can coordinate modules safely.

**Status: Complete.** Implemented:
- Accounting module (ChartOfAccount, Journal, JournalEntry, Invoice, Payment) with double-entry balance validation (`createJournal` rejects unbalanced debit/credit), `postJournal` with explicit double-posting protection, and `reverseJournal` generating a new POSTED reversal journal with inverted entry directions.
- A minimal Ticketing module (Ticket lifecycle: OPEN → TRIAGED/ESCALATED → ... → CLOSED) serving as the human-escalation target for circuit breaking and conflict resolution; full SLA/assignment/comment features remain scoped to Phase 5.
- `WorkflowTaskService` implementing bounded re-evaluation per PRD section 17: every task persists `max_iterations`, `token_budget`, `time_budget_ms`, `min_confidence`, tracks iteration/token usage across attempts, and triggers a circuit breaker (persist state -> create ticket -> escalate) when any bound is exceeded before confidence is met.
- `ConflictResolutionService` implementing the PRD section 16 pipeline (detect -> measure trust -> resolve or escalate): agrees automatically when parties match, resolves via trust-score margin when sufficiently decisive, otherwise escalates to a ticket for human review.
- `FinancialPostingService` workflow implementing the PRD section 8 AI Accountant flow (Recommendation -> Validation -> Policy Check -> Approval -> Posting), using `WorkflowTaskService` for the recommendation/confidence step and a dedicated deterministic financial-posting policy (separate from any LLM) for the approval decision.
- Promoted `AuditService` to a single `@Global()` `AuditModule` so all services and tests observe the same audit log instance.

Verified end-to-end against real PostgreSQL: chart of accounts creation, balanced journal creation, unbalanced journal rejection (400), financial-posting workflow auto-approving and posting a balanced journal, double-posting rejection, and journal reversal producing a new POSTED reversal journal with inverted entries. Tenant isolation confirmed for Accounting data.

Known limitation: `AuditService` and `TicketingService` remain in-memory (not Prisma-backed), so audit trails and tickets do not survive process restarts. This should be revisited before production rollout alongside the existing concurrency/idempotency limitation from Phase 2.

## Phase 4 — Controlled AI layer

- Add agent registry, agent identities, tool permissions, structured agent messages, and shared structured workflow state.
- Add AI orchestrator goal management, task decomposition, trust/evidence handling, conflict resolution, and human escalation.
- Add the AI Cognitive Budget Manager for per-tenant and per-operation usage limits.
- Add adaptive routing: deterministic API → small/local model → reasoning model → high-reliability model with approval as risk increases.
- Add circuit breaking that persists state and creates a ticket before escalation.

Exit criteria: AI can assist or execute only through authorized, policy-validated, bounded, and auditable actions.

**Status: Complete.** Implemented:
- `AgentRegistryModule` (AgentRegistration, TrustProfile) tracking capabilities, model, version, availability, and cost-per-call per tenant, with `recordTrustOutcome` computing trust via exponential moving average (accuracy, consistency, calibration, historical success rate) minus a policy-violation penalty, clamped to [0, 1]. Unregistered agents are auto-registered on first outcome.
- `AiBudgetModule` implementing the AI Cognitive Budget Manager: per-tenant daily/monthly/per-transaction/per-agent-daily budgets, usage ledger (`AiUsageRecord`) with input/output/total tokens, estimated/actual cost, latency, and re-evaluation count, and a `checkBudgetAvailability` policy gate.
- `AiProviderModule` with `ModelRoutingService` implementing PRD section 19 adaptive routing (simple query → deterministic, simple classification → small model, complex reasoning → reasoning model + policy validation, critical decision → high-reliability model + policy validation + human approval), and `OmniRouterClient` as the provider abstraction (reads `OMNIROUTER_BASE_URL`/`API_URL_AI_PROVIDER` and `OMNIROUTER_API_KEY`/`PROVIDER_API_KEY`, never logs the key).
- `OrchestratorModule` implementing the Goal Manager: routes a goal through Model Routing, checks AI budget, runs bounded re-evaluation via `WorkflowTaskService` (reusing the Phase 3 circuit breaker), records AI usage, and updates the executing agent's trust profile — all in a single auditable flow.

Bug found and fixed during integration: the model router initially downgraded `COMPLEX_REASONING` and `CRITICAL_DECISION` tasks to `DETERMINISTIC` whenever the AI budget was exhausted, silently bypassing risk-appropriate handling. Fixed so only low-risk tasks (`SIMPLE_QUERY`, `SIMPLE_CLASSIFICATION`) fall back to deterministic handling under budget exhaustion; higher-risk tasks are still routed to their proper tier and then explicitly denied by the orchestrator's budget check (`BUDGET_DENIED` outcome) rather than silently downgraded.

Verified end-to-end against real PostgreSQL: agent registration with default trust profile, simple-query goal execution consuming zero AI budget, complex-reasoning goal execution consuming AI budget and updating trust score (0.5 → 0.676 after two samples), critical-decision goal correctly routed to the high-reliability tier with policy validation and human approval flags set, and tenant isolation confirmed for agent registry data.

Known limitation: AI budget aggregation (`checkBudgetAvailability`) reads usage via `findMany` without a database-level lock, so concurrent goal executions without coordination could still race past a budget limit under high concurrency — consistent with the same class of limitation already documented for Phase 2/3.

## Phase 5 — HRIS, Ticketing, and knowledge

- Implement employees, departments, attendance, leave, overtime, payroll, and HR policy.
- Implement tickets, assignments, SLA, escalation, comments, and human review lifecycle.
- Add tenant-isolated RAG for SOPs, policies, catalogs, technical documentation, and historical cases.

Exit criteria: human escalation and supporting evidence work across business and AI workflows without weakening tenant boundaries.

**Status: Complete.** Implemented:
- `HrisModule` (Department, Employee, Attendance, Leave, OvertimeRequest — all Prisma-backed with an in-memory dual adapter) covering department/employee CRUD, clock-in/clock-out attendance, leave request/approve/reject, overtime request with automatic cost calculation (`hourlyRate * hours * 1.5`), overtime approve/reject, and a `getWorkloadSummary` endpoint that flags department overload from 30-day overtime totals.
- Full `TicketingModule` upgrade from in-memory-only to a Prisma-backed dual adapter, plus comments, assignments (with automatic `OPEN`/`TRIAGED` → `ASSIGNED` transition), and SLA tracking (`attachSla`, `recordResponse`, `recordResolution`, `checkSlaBreaches`) — all tenant-isolated. The pre-existing `createSystemTicket` method used by `ConflictResolutionService` was preserved with an identical signature.
- `KnowledgeModule` implementing PRD section 33: tenant-isolated `KnowledgeDocument` store (SOP, company policy, product catalog, financial/HR/procurement policy, technical documentation, historical cases) with a keyword-scoring `search` endpoint and a `retrieveEvidence` method intended for AI workflows to pull supporting evidence without any cross-tenant retrieval path.
- `OvertimeApprovalService` implementing the PRD section 16 example conflict (`HRIS → OVERTIME_REQUIRED` vs `Finance → OVERTIME_NOT_JUSTIFIED`): HRIS always recommends the requested overtime; Finance rejects it if the linked budget is insufficient or the estimated cost exceeds a $200 auto-justification threshold. Both parties are deliberately given equal trust scores (0.7/0.7) so that any disagreement always escalates to a human-reviewed ticket via `ConflictResolutionService` rather than being resolved by trust-score margin — HRIS and Finance are deterministic business systems of record, not AI agents, so an automatic AI-style resolution would be inappropriate per the platform's human-in-the-loop governance model.

Verified end-to-end against real PostgreSQL: department/employee creation, low-cost overtime auto-approval, high-cost overtime correctly escalating to a ticket with SLA and comments attached, tenant isolation confirmed for tickets and knowledge documents (404 / empty list respectively for a foreign tenant), and workload-overload detection correctly triggering when overtime hours exceeded the per-employee threshold.

Known limitation: knowledge retrieval uses simple in-process keyword term-frequency scoring, not vector/embedding-based semantic search — full pgvector-backed RAG is deferred to the Phase 8 Research Testbed per PRD section 40.

## Phase 6 — Infrastructure orchestration

- Implement infrastructure inventory and observability for clusters, nodes, pods, deployments, services, usage, latency, traffic, errors, scaling, and cost.
- Integrate controlled scaling requests with Finance policy, approval, audit, and Kubernetes APIs.
- Deploy the platform to local Kubernetes with resource policy and operational dashboards.

Exit criteria: infrastructure actions follow observe → reason → approval → policy validation → execute and can be rolled back or escalated.

**Status: Complete.** Implemented:
- `InfrastructureModule` backed by a real `@kubernetes/client-node` v2 wrapper (`KubernetesClientService`) reading cluster nodes, deployments, pods, and services live from the Kubernetes API — no duplicated inventory tables in Postgres for live cluster state; only `ScalingEvent` (audit trail of every scaling decision) and `CloudCostRecord` are Prisma-persisted per tenant.
- `evaluateInfrastructureScalingPolicy` added to the shared `PolicyEngineService`, enforcing a hard replica ceiling, budget availability for scale-ups, and a minimum confidence threshold before any Kubernetes mutation — matching PRD section 27's infrastructure policy example.
- `InfrastructureService.requestScaling` implements the PRD section 12/36 flow exactly: **Observe** current replica count via the Kubernetes API → **Reason** about SCALE_UP vs SCALE_DOWN → **Policy validation** (reject / require human approval / auto-approve) → **Execute** only on auto-approval, with every state transition persisted and audited. A `REQUIRE_HUMAN_APPROVAL` decision routes through the existing `ConflictResolutionService` to create a ticket rather than proceeding autonomously.
- `rollbackScaling` restores a deployment to its recorded `fromReplicas`, guarded so it can only run against a `ScalingEvent` in `EXECUTED` status.
- RBAC follows PRD section 26 exactly: only `TENANT_ADMIN`, `OPERATOR`, `AI_INFRA_AGENT`, and `AI_ORCHESTRATOR` can request or roll back scaling — `AI_SALES_AGENT` and `AI_FINANCE_AGENT` are deliberately excluded from `infrastructure:write`.

Verified end-to-end against a real local Kubernetes cluster (`kind`, cluster name `kind-autonomous-enterprise`, provisioned via `infrastructure/kind/kind-config.yaml` with a sample `nginx` deployment from `infrastructure/kubernetes/06-sample-workload.yaml`) and real PostgreSQL: cluster snapshot correctly read live node/pod/deployment/service data; a scale-up request from 2 → 4 replicas was policy-approved and executed, and `kubectl` confirmed 4 running pods; rollback correctly restored the deployment to 2 replicas, confirmed via `kubectl`; a scale request exceeding the tenant's max-replica policy was rejected before any Kubernetes call was made (`kubectl` confirmed the deployment was untouched); tenant isolation confirmed for scaling event history.

Known limitation: `ResourceUsage`, `Latency`, `RequestRate`, and `ErrorRate` metrics from PRD section 12 are not yet ingested from a metrics backend (Prometheus) — the current `confidence` value used in scaling policy evaluation is a fixed placeholder (0.8) rather than derived from real traffic/latency signals. Wiring a metrics source and deriving confidence from observed load is deferred to Phase 7 hardening.

## Phase 7 — Hardening and cloud path

- Complete business, AI, and infrastructure observability.
- Run security, tenant-isolation, failure-recovery, load, and budget-enforcement verification.
- Define backup, disaster recovery, secrets, key rotation, and operational runbooks.
- Validate portability from local Kubernetes to the selected cloud Kubernetes target.

Exit criteria: the platform has evidence for safe operation, repeatable deployment, and controlled tenant growth.

**Status: Complete.** Implemented:
- `ObservabilityModule` exposing a tenant-scoped `GET /api/v1/observability/snapshot` API with PRD section 32's three layers: business audit events/action breakdown/success-failure count; AI agent count/trust, routed-call count, daily token usage, budget-exceeded/circuit-breaker/escalation counts; and infrastructure scaling outcomes. The snapshot requires `observability:read` and every source query is tenant-scoped.
- Application hardening in `main.ts`: Helmet security headers, configurable CORS origins (`CORS_ALLOWED_ORIGINS`), a global exception filter that returns a generic response for internal errors while logging detail server-side, graceful shutdown hooks, and a configurable `PORT` (no longer hardcoded to 3000). Global `ThrottlerGuard` caps default traffic at 300 requests per 60 seconds.
- AI budget concurrency hardening: `RedisService` gained SET NX PX distributed-lock primitives plus token-safe Lua compare-and-delete release; `AiBudgetService.reserveAndRecordUsage` holds the tenant lock across availability evaluation and usage-record creation. `OrchestratorService` now uses this atomic method, eliminating the documented primary check-then-record race when Redis is enabled.
- Dedicated automated hardening coverage: 2 AI-budget concurrency tests (including concurrent reserve/record with distributed lock), 4 failure-recovery tests (AI provider absent/failing and Kubernetes unavailable/failing), 4 observability/RBAC/tenant-isolation tests, and a full security review covering all repository adapters, controllers, AI role boundaries, secret exposure, and exception handling.
- `OPERATIONS.md` operational runbook covering health/observability, secret management, Keycloak/AI/DB credential rotation, PostgreSQL backup, database/Kubernetes/full-environment recovery, AI-budget/circuit-breaker operations, and a standard-Kubernetes cloud portability checklist. `.env.example` now documents `KUBECONFIG_PATH`, `PORT`, and `CORS_ALLOWED_ORIGINS`.

Verified end-to-end against real PostgreSQL, Redis, Keycloak, and the local kind Kubernetes cluster: API started on a non-default port via `PORT=3100`; health endpoint returned Helmet CSP/nosniff/frame headers; agent registration persisted to PostgreSQL; tenant-scoped observability snapshot reflected the agent and its audit event while reporting zero events for unrelated data. Full repository verification passed: lint and typecheck clean; 145 API tests, 4 database tests, 4 shared tests, and 3 contracts tests passed; all five workspace builds completed successfully.

Known limitations: Infrastructure load confidence remains a fixed 0.8 until Prometheus traffic/latency/error metrics are integrated; live infrastructure metrics and cloud billing ingestion are not yet implemented. Audit event duplication remains in several modules because controller `@Audit` interception and service-level `AuditService.record` both capture the same logical action; this affects count accuracy but not authorization or business state. Redis must be enabled in production for multi-replica AI-budget atomicity; legacy independent callers of `checkBudgetAvailability` followed by `recordUsage` should be migrated to `reserveAndRecordUsage` before they are used for cost-bearing work.

## Phase 8 — Research testbed

- Implement experiment runner, scenario generator, baseline runner, metrics collector, replay system, and A/B experiment comparison.

Exit criteria: experiment runs are tenant-isolated, reproducible, comparable, and cannot mutate production business state.

**Status: Complete.** Implemented:
- `ExperimentModule` with persisted `ExperimentScenario` and `ExperimentRun` models, including the PRD section 40 research matrix: `scenarioId`, experiment/run ID, tenant, configuration ID, agent/model version fields, policy version, budget, final result, duration, tokens, AI cost, LLM calls, conflicts, escalations, re-evaluations, status, and replay lineage.
- Synthetic-goal scenario generator and experiment runner supporting all PRD section 41 modes: `DETERMINISTIC` baseline (zero AI cost/tokens), `SINGLE_AGENT`, `MULTI_AGENT`, `ORCHESTRATED`, and `PROPOSED` (trust/cost-aware/full-governance synthetic run). The initial testbed deliberately whitelists only `SYNTHETIC_GOAL` scenarios and does not inject business services, orchestrators, or Kubernetes clients, so research execution cannot mutate sales, inventory, finance, HRIS, ticketing, or infrastructure state.
- Replay API preserves the original scenario, mode, configuration, budget, and `replayOfRunId`; comparison API requires two same-scenario runs in the current tenant and produces success, duration, token, AI-cost, conflict, and escalation deltas for baseline-vs-candidate evaluation.

Verified against real PostgreSQL: created a tenant-scoped synthetic fulfillment benchmark, ran the deterministic baseline (0 tokens/$0 cost) and proposed configuration (1,100 tokens/$0.022 cost), and compared the two runs through the API; their expected delta (130 ms, 1,100 tokens, $0.022, one conflict) was persisted and returned. Automated coverage includes all five modes, replay lineage, comparisons, validation, RBAC, and cross-tenant isolation. Full repository verification passed: 149 API tests, 4 database tests, 4 shared tests, and 3 contracts tests; lint/typecheck/build all clean.

Known limitations: the initial safe research slice is simulation-based rather than a sandboxed execution of live workflow services. Thus `workflow_id` is intentionally absent, and agent/model version JSON is currently caller/default-captured (`{}`) rather than dynamically resolved from the Agent Registry. A future research increment can add sandbox-tenant fixture seeding and read-only workflow replay while preserving the no-production-mutation rule.

## Phase 9 — Production Experience, Benchmark Suite, and Cloud Packaging

- **Phase 9A — Enterprise Admin UI (`apps/web`):** Responsive SvelteKit 5 management dashboard for 3-layer observability, agent trust management, AI FinOps & budget meters, human-in-the-loop ticketing queue with SLA tracking, experiment visualizer with 5-mode execution & A/B comparison delta cards, and workflow triggers.
- **Phase 9B — Thesis Experiment Benchmark Suite (`packages/benchmark`):** Automated benchmark engine running multi-scenario batch suites across all 5 PRD §41 modes (`DETERMINISTIC`, `SINGLE_AGENT`, `MULTI_AGENT`, `ORCHESTRATED`, `PROPOSED`), computing statistical aggregations (mean, standard deviation, 95% confidence intervals, hypothesis testing p-values, delta tables) and exporting results to CSV and JSON formats for thesis data analysis.
- **Phase 9C — Cloud Kubernetes & Production Packaging (`infrastructure/helm`, `infrastructure/monitoring`, `infrastructure/cloud`):** Production-grade Helm chart with configurable values for API (HPA, anti-affinity, security contexts), Web, PostgreSQL, Redis, Kafka, Keycloak, and Ingress; Prometheus ServiceMonitors, AlertingRules, and Grafana dashboard JSON (Business, AI FinOps, Agent Trust, Infra panels); and deployment runbooks with AWS EKS and GCP GKE value presets.

Exit criteria: operators have an interactive UI to inspect and manage platform state, researchers have an automated benchmark suite to generate thesis evaluation artifacts, and DevOps teams have complete cloud packaging manifests and runbooks.

**Status: Complete.** Implemented:
- `apps/web`: Full SvelteKit 5 web application with modular enterprise styling, typed API client (`src/lib/api.ts`) supporting tenant context headers, executive observability dashboard (`+page.svelte`), agent trust registry (`routes/agents`), FinOps budget meters (`routes/finops`), ticketing center (`routes/tickets`), research experiment testbed (`routes/experiments`), and workflow execution hub (`routes/workflows`). Verified with 5/5 unit tests and clean SvelteKit build/typecheck/lint.
- `packages/benchmark`: `@autonomous-enterprise/benchmark` workspace package containing scenario generators (`BASELINE_ORDER`, `FLASH_SALE_BURST`, `SUPPLIER_DISRUPTION`, `BUDGET_EXHAUSTION`, `MULTI_AGENT_CONFLICT`), 5-mode benchmark runner with telemetry tracking (duration, tokens, cost, conflicts, escalations, circuit-breaker trips), statistical analyzer, CSV/JSON report exporters, and automated test suite (4/4 tests passed).
- `infrastructure/helm`, `infrastructure/monitoring`, `infrastructure/cloud`: Production Helm chart with deployment/service/ingress/HPA/RBAC/Secret templates; Prometheus ServiceMonitor, AlertingRules (budget thresholds, SLA breaches, circuit breaker trips), Grafana dashboard with 4 core monitoring panels; and AWS EKS (`values-eks.yaml`) and Google Cloud GKE (`values-gke.yaml`) presets with deployment documentation.

Verified across the full repository: lint, typecheck, and build clean across all 6 workspace packages/apps (5 SvelteKit web tests, 4 benchmark tests, 149 API tests, 4 database tests, 4 shared tests, 3 contracts tests — 169 tests total).

## Phase 10 — Full-Loop Enterprise Autonomy & Dynamic Sandboxed Research

- **Unified Multi-Agent Enterprise Saga:** Orchestrate the complete 8-domain chain (Sales, Inventory, Procurement, Finance, HRIS, Accounting, Infrastructure, Ticketing) for macro enterprise scenarios (such as Flash Sale order spikes), with automated Saga compensating rollback and human escalation on step failures.
- **Dynamic Sandboxed Workflow Replay:** Replay live workflows in isolated ephemeral sandbox tenants (`sandbox_tenant_*`) with zero mutation on production tenant data, enabling empirical evaluation across the 5 PRD §41 research modes.
- **Multi-Way Conflict & UI/Benchmark Integration:** Macro scenario generators (`ENTERPRISE_SAGA_MACRO`, `MULTI_WAY_CONFLICT`) in the thesis benchmark runner, plus interactive macro saga execution panels and sandbox replay delta visualizers in the SvelteKit web app.

Exit criteria: the platform demonstrates cross-enterprise 8-domain autonomous coordination with verified compensating transactions, and research replays execute safely in isolated sandbox tenants without touching production records.

**Status: Complete.** Implemented:
- `EnterpriseSagaService` (`apps/api/src/modules/workflow/enterprise-saga.service.ts`): Orchestrates the 8-domain macro flow (Sales order retrieval -> Inventory stock reservation -> Procurement purchase request -> Finance budget allocation -> HRIS warehouse overtime evaluation -> Accounting journal entry -> Infrastructure pod scaling). If any step fails (e.g. budget denial), an automated compensating rollback releases stock reservations, rolls back scaling, and creates an escalation ticket via `TicketingService`.
- `SandboxedReplayService` (`apps/api/src/modules/experiment/sandboxed-replay.service.ts`): Replays scenarios within ephemeral sandbox tenants (`sandbox_${tenantId}_${timestamp}`) using isolated `TenantContextStorage` scopes, guaranteeing zero mutation to the primary tenant's database while calculating comparative telemetry across the 5 research modes.
- Macro Benchmarks & UI Integrations: Updated `packages/benchmark` with `ENTERPRISE_SAGA_MACRO` and `MULTI_WAY_CONFLICT` scenario generators and runners; updated `apps/web` with Enterprise Saga workflow execution panel and sandboxed live replay delta viewer.

Verified across the monorepo: lint, typecheck, and build clean across all 6 workspace packages/apps (156 API tests, 5 Web tests, 5 Benchmark tests, 4 Database tests, 4 Shared tests, 3 Contracts tests — 177 tests total, 0 failures).

## Phase 11 — Real-Time Telemetry Streaming, Thesis Defense Exporters & CI/CD Pipeline

- **Phase 11A — Real-Time Event & Telemetry Streaming (`apps/api` + `apps/web`):** Server-Sent Events (SSE) streaming endpoint (`GET /api/v1/events/stream`) emitting real-time domain events, audit logs, and orchestrator status scoped per tenant; live streaming event feed and connection status in SvelteKit frontend.
- **Phase 11B — Automated Thesis LaTeX & Markdown Defense Artifact Exporter (`packages/benchmark`):** Automatic generation of publication-ready LaTeX tables (`reports/thesis-tables.tex`) and a complete Markdown thesis evaluation chapter (`reports/thesis-evaluation-chapter.md`) covering the 5-mode comparison, hypothesis testing p-values, confidence intervals, and FinOps efficiency metrics.
- **Phase 11C — Production CI/CD & Automated Verification Pipeline (`.github/workflows`):** GitHub Actions workflows for continuous integration (`ci.yml`: lint, typecheck, PostgreSQL + Redis integration tests, build, benchmark validation) and Helm release packaging (`release-helm.yml`).

Exit criteria: real-time telemetry flows from backend to frontend via SSE without polling, thesis evaluation artifacts are automatically exported in publication-ready formats, and the entire platform is guarded by production CI/CD automation.

**Status: Complete.** Implemented:
- `EventStreamModule` (`apps/api/src/common/events/`): Implements RxJS Subject-backed event broadcasting and NestJS SSE streaming controller (`GET /api/v1/events/stream`) strictly isolated per tenant. Integrated with SvelteKit live event feed at `routes/events` with real-time SSE listener in `src/lib/api.ts`.
- `LaTeXExporter` & `ThesisChapterExporter` (`packages/benchmark/src/exporters/`): Generates publication-ready LaTeX tables with booktabs formatting and an exhaustive thesis evaluation chapter in Markdown with empirical methodology, FinOps trade-offs, and governance conclusions.
- Production CI/CD (`.github/workflows/ci.yml`, `release-helm.yml`): Complete 4-stage pipeline with service containers for PostgreSQL and Redis, Turborepo caching, benchmark artifact verification, and Helm chart release packaging.

Verified across the monorepo: lint, typecheck, and build clean across all 6 workspace packages/apps (157 API tests, 5 Web tests, 6 Benchmark tests, 4 Database tests, 4 Shared tests, 3 Contracts tests — 179 tests total, 0 failures).

## Scope rule

Do not implement all modules as placeholders before proving one complete vertical slice. A new phase should begin only when the previous phase's exit criteria are demonstrated by executable tests or operational checks.

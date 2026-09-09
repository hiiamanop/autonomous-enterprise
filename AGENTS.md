# AGENTS.md

## Repository state

- This repository is currently specification-only: `PRD.md` is the only project file. Do not assume application code, package managers, build scripts, tests, or CI exist.
- Treat `PRD.md` as the product source of truth until executable project configuration is added.

## Architecture constraints

- The target is a modular, service-oriented, multi-tenant enterprise platform deployed first to local Kubernetes and later to cloud Kubernetes.
- Business modules remain the system of record. AI agents are a decision/orchestration layer and must not become the sole source of truth.
- The high-level request path is Web/Mobile UI → API Gateway/BFF → business/workflow/identity-and-tenant services → AI agent layer, with knowledge/RAG, event bus, audit/observability, and infrastructure orchestration supporting the system.
- Keep business-domain boundaries explicit for Sales, Inventory, Procurement, Accounting, Finance, HRIS, Ticketing, and Infrastructure.

## AI safety and governance

- Autonomous actions must respect policy, trust, evidence, budget, and human-escalation requirements; critical financial decisions may require human approval.
- Prevent infinite agent loops. Tasks need bounded iterations, token budget, time budget, and minimum confidence; circuit breaking must persist state and create a ticket before human escalation.
- Preserve tenant isolation and track AI usage per tenant, including token counts, LLM/agent calls, re-evaluations, cost, and latency.
- Prefer deterministic APIs for simple queries, smaller/local models for simple classification, and higher-reliability reasoning models only when task complexity and risk justify them.

## Multi-agent development

- Use delegated multi-agent work to accelerate implementation when tasks can be separated by clear module or concern boundaries.
- Delegated multi-agent tasks must use the `Combo: Cheap` model unless the coordinating agent explicitly determines that a task requires a different model.
- Split work by non-overlapping ownership, such as architecture/contracts, a business module, platform services, tests, or infrastructure; do not let agents edit the same files concurrently.
- Give each delegated agent the relevant PRD section, explicit files or boundary, acceptance criteria, and verification command; require a concise report of changes, risks, and verification results.
- Keep one coordinating agent responsible for contract consistency, integration, tenant isolation, authorization, policy enforcement, and final review.
- Integrate in dependency order: shared contracts and foundations first, dependent modules second, cross-module workflows third, and deployment or optimization last.
- Delegation does not remove review requirements: inspect every agent change, resolve contract conflicts centrally, and run the repository's full documented verification before completion.

## Verification

- No repository-defined lint, typecheck, test, build, code-generation, migration, or deployment commands exist yet. Discover and document them when implementation tooling is introduced rather than guessing commands.

# Architecture Guide

## Purpose

This document turns the product direction in `PRD.md` into implementation boundaries. It is the architectural source of truth until executable architecture, deployment manifests, and service contracts exist.

## Core invariants

- Business modules are the system of record; AI agents are a decision and orchestration layer.
- A module owns its data, business rules, API, and workflow state.
- Agents communicate through structured APIs and events, never by directly accessing another module's database.
- Every business operation is tenant-scoped and authorization-checked.
- LLM reasoning cannot override hard policy, authorization, budget, or human-approval constraints.
- Autonomous work is bounded by iteration, token, time, and confidence limits.
- Every autonomous decision and execution must be auditable.

## Request path

The default request path is:

```text
Web / Mobile UI
  -> API Gateway or BFF
  -> Identity and Tenant Context
  -> Business or Workflow Service
  -> AI Agent Layer when reasoning or orchestration is needed
  -> Policy validation
  -> Explicit module API or infrastructure API
```

Simple, deterministic queries should bypass the agent layer. AI should be introduced only when interpretation, coordination, recommendation, conflict resolution, or controlled automation is required.

## Module boundaries

The initial business boundaries are:

- Sales: customers, quotations, orders, pricing, discounts, and order status.
- Inventory: products, SKUs, warehouses, stock, movements, reservations, and reorder rules.
- Procurement: suppliers, purchase requests/orders, quotations, approvals, and goods receipts.
- Accounting: chart of accounts, journals, ledger, receivables, payables, invoices, payments, and posting.
- Finance: budgets, expenses, financial approval, and financial policy.
- HRIS: employees, departments, attendance, leave, overtime, payroll, and HR policy.
- Ticketing: tickets, comments, assignments, priorities, status, escalation rules, and SLA.
- Infrastructure: clusters, nodes, pods, deployments, services, resource usage, latency, traffic, errors, scaling, and cost.

Cross-module processes use contracts and events. They do not merge ownership into a shared business model.

## Platform services

Supporting services should remain separate from business modules:

- Identity and tenant context
- API Gateway / BFF
- Workflow and task coordination
- AI orchestrator and agent registry
- Policy and authorization evaluation
- Knowledge / RAG
- Event bus
- Audit and observability
- AI cognitive budget management
- Infrastructure orchestration

The exact service split may evolve, but data ownership and permission boundaries must remain explicit.

## AI orchestration

The orchestrator manages goals, task decomposition, agent selection, shared structured state, trust/evidence evaluation, conflict resolution, re-evaluation, execution, and escalation.

Each task must carry limits equivalent to:

```text
max_iterations
max_token_budget
max_time_budget
min_confidence
```

A failed or non-improving re-evaluation must stop safely, persist state, create or update a ticket, and escalate to a human when required.

## Authorization and policy

- Users and agents have identities, roles, permissions, and tenant context.
- Agent permissions are least-privilege and domain-specific.
- The policy engine is separate from the LLM: the LLM may provide reasoning, but policy decides hard constraints.
- Critical financial decisions and actions above tenant-defined thresholds require human approval.
- Infrastructure actions follow observe → reason → approval → policy validation → execute.

## Tenant isolation

The initial strategy is shared database plus `tenant_id`, application-level isolation, and RBAC. The design must allow later migration to separate schemas, databases, or dedicated deployments without changing business logic.

Tenant configuration includes currency, timezone, tax, approval, AI budget, AI, financial, HR, procurement, and infrastructure policies. Knowledge bases and all business data are tenant-isolated.

## API and event contracts

All modules expose versioned structured APIs. AI communication also uses structured APIs or events. A module's database is private to that module.

Agent messages should include at least:

```text
message_id
tenant_id
workflow_id
sender
receiver
intent
payload
confidence
priority
```

Important domain changes should emit events such as `OrderCreated`, `StockLow`, `PurchaseRequestCreated`, `PaymentReceived`, `TicketCreated`, `ScalingRequested`, `ScalingExecuted`, `AgentConflictDetected`, and `AIInteractionBudgetExceeded`.

## Audit and observability

Autonomous decisions record timestamp, tenant, actor, agent, workflow, input, decision, confidence, trust score, policy result, tool calls, token usage, model, and execution result.

Observability covers three dimensions:

- Business: orders, revenue, inventory, procurement, tickets, and employees.
- AI: calls, tokens, latency, confidence, trust, failures, re-evaluation, and escalation.
- Infrastructure: CPU, memory, network, latency, requests, errors, pods, nodes, and scaling.

## Final Technology Stack

- **Language & Runtime:** TypeScript / Node.js
- **Monorepo Management:** pnpm + Turborepo
- **Backend Framework:** NestJS
- **Frontend Framework:** SvelteKit
- **Database & Caching:** PostgreSQL + Redis
- **APIs & Protocols:** REST/OpenAPI + gRPC (OpenAPI-first + Protobuf)
- **Messaging & Eventing:** Transactional Outbox pattern + Apache Kafka
- **Identity & Authentication:** Keycloak
- **Local Infrastructure:** Docker Compose + Kind
- **Testing:** Vitest + Testcontainers
- **AI Provider Abstraction:** OmniRouter

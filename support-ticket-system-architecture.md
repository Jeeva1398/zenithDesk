# ZenithDesk — Project Architecture & Context

## 1. Project Overview

**ZenithDesk** is a small-scale, multi-tenant SaaS support ticket system
(Zendesk-style), built as a portfolio project to demonstrate both **full-stack
engineering** (React + Node + MySQL) and **data engineering** (ETL, warehouse
modeling, analytics) skills, in support of a transition from MERN developer
toward a Data Engineer role.

Customers create tickets either through a normal form **or** through an
AI chatbot powered by a locally-hosted **Small Language Model (SLM)**, which
extracts structured ticket data from natural conversation.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React (Vite) | Agent dashboard + customer chat widget |
| Backend | Node.js + Express | REST API |
| Database (OLTP) | MySQL | Transactional store for the live app |
| Query layer | Raw SQL via `mysql2` / Knex | Preferred over heavy ORM — better for SQL/interview depth |
| Chatbot inference | Ollama (local) running an SLM | Phi-3-mini / Llama 3.2 (1B–3B) / Qwen2.5 (0.5B–1.5B) |
| Validation | Zod / Joi | Validates SLM's JSON output before DB insert |
| ETL | Node or Python script | Scheduled batch job, extract → transform → load |
| Orchestration (later) | Airflow or Dagster | Schedules/retries the ETL pipeline |
| Warehouse | Second MySQL schema (or DuckDB locally) | Fact/dimension tables for analytics |
| Containerization | Docker Compose | App DB + warehouse DB + Ollama + API, all local |

---

## 3. OLTP Schema (MySQL — live application database)

Core tables:
- `organizations` — tenant boundary (multi-tenant SaaS)
- `users` — customers, scoped to an organization
- `agents` — support staff, scoped to an organization
- `tickets` — subject, description, category, priority, status, org_id, customer_id, assigned_agent_id, timestamps
- `ticket_comments` — thread of replies on a ticket (agent or customer)
- `chat_sessions` — holds in-progress chatbot conversation state until a ticket is confirmed/created

Key relational patterns to implement (good interview talking points):
- Multi-tenancy via `org_id` scoping on every table + app-level enforcement
- Foreign keys: `tickets.customer_id → users.id`, `tickets.assigned_agent_id → agents.id`
- Status/priority as `ENUM` columns
- Indexes on `org_id`, `status`, `created_at` for dashboard query performance

---

## 4. API Structure (Express)

- Auth (JWT-based, scoped by org/role: customer vs agent)
- `POST /tickets` — create ticket (from form or chatbot)
- `GET /tickets` — list/filter tickets (agent dashboard)
- `GET /tickets/:id` — ticket detail + comment thread
- `PATCH /tickets/:id` — update status/priority/assignment
- `POST /tickets/:id/comments` — add reply
- `POST /chat/message` — send a message to the chatbot, get bot reply + extraction status

---

## 5. Chatbot / SLM Architecture

```
React chat widget
      ↓ (customer message)
Node/Express API  →  chat_sessions (holds conversation state)
      ↓
Ollama (local SLM: Phi-3-mini / Llama 3.2 / Qwen2.5)
      ↓
Strict prompt → model returns JSON only:
  { category, priority, summary, description, needs_more_info }
      ↓
Server validates JSON (Zod/Joi)
   ├─ if complete   → INSERT into `tickets`, confirm to customer
   └─ if incomplete → bot asks a targeted follow-up question
      ↓
Response streamed back to React chat UI
```

Design notes:
- SLMs are less reliable than large models at structured output — always validate
  server-side and have a fallback (clarifying question or simple rule-based
  classifier) if parsing fails.
- Conversation state lives in `chat_sessions` until the ticket is confirmed, then
  gets cleared/archived.
- Ollama exposes a local REST API — no external API cost, and "ran local
  inference" is a good resume point.

---

## 6. Data Engineering Layer (ETL → Warehouse)

**Extract**: pull new/changed rows from `tickets` and `ticket_comments` since the
last pipeline run (`updated_at > last_run_time`).

**Transform**:
- Calculate resolution time per ticket (first response time, total time to close)
- Bucket by priority/category
- Aggregate ticket counts and avg resolution time per agent, per org, per day

**Load**: upsert into warehouse fact/dimension tables:
- `dim_organization`, `dim_agent`, `dim_category`
- `fact_ticket_daily` — daily rollup: ticket_count, avg_resolution_time, by org/agent/category

**Why separate from the app DB**: OLTP is optimized for fast individual
read/writes; the warehouse (OLAP-style) is optimized for scanning/aggregating
across many rows for reporting, without slowing down the live app.

**Orchestration path**:
1. Start with a simple scheduled Node/Python script (cron) — this alone counts
   as a legitimate ETL pipeline for the portfolio.
2. Later, wrap it in Airflow or Dagster as a DAG with retries/scheduling.
3. Optionally introduce dbt for SQL-based transform modeling once the warehouse
   schema stabilizes.

---

## 7. Project Structure — Two Separate Repos

The chatbot widget is built and versioned as its own project, not embedded
inside the main app. This mirrors how real support-widget products work (e.g.
Intercom's widget is a separate embeddable service that integrates with a
ticketing backend over an API).

- **`zenithdesk`** — main app: React agent dashboard + Node/Express API + MySQL
- **`zenithdesk-chatbot`** — standalone chatbot widget: embeddable JS widget +
  its own small backend service that talks to Ollama, then calls ZenithDesk's
  ticket API to create tickets

---

## 8. Phased Build Plan (commit per phase)

Each phase below is built and committed separately rather than shipping the
whole project in one pass — this keeps the git history realistic and
incremental, matching how the project would actually evolve.

**`zenithdesk` repo:**

**Phase 1 — Project setup**
- `npm init`, folder structure (`/client`, `/server`), ESLint/Prettier config,
  `.env.example`, README skeleton, MySQL connection boilerplate
- Commit: `chore: initial project setup`

**Phase 2 — Schema design**
- MySQL migration files for `organizations`, `users`, `agents`, `tickets`,
  `ticket_comments`
- Commit: `feat: initial database schema and migrations`
- (Later, once chatbot integration begins: `feat: add chat_sessions table`)

**Phase 3 — API (auth first, then resources)**
- Commit: `feat: auth (JWT, login/register)`
- Commit: `feat: tickets CRUD API`
- Commit: `feat: ticket comments API`

**Phase 4 — Frontend (agent dashboard)**
- Commit: `feat: agent dashboard layout`
- Commit: `feat: ticket list and filters`
- Commit: `feat: ticket detail view`

**Phase 5 — Seed data**
- Commit: `chore: add seed script with fake ticket data`

**Phase 7 — ETL/warehouse layer**
- Commit: `feat: warehouse schema`
- Commit: `feat: ETL extract-transform-load script`

**`zenithdesk-chatbot` repo:**

**Phase 6 — Chatbot widget**
- Commit: `chore: chatbot widget project setup`
- Commit: `feat: connect to local Ollama SLM`
- Commit: `feat: structured extraction + validation`
- Commit: `feat: embeddable widget UI`
- Commit: `feat: integrate with ZenithDesk ticket API`

---

## 9. Notes on Keeping the Codebase Looking Naturally Built

- Code for each phase is generated with AI assistance; you review it yourself
  and commit it in your own words — commits are never made on your behalf
- Commit in uneven, phase-sized chunks rather than one large completed commit
- Expect and allow for messy iteration: refactor commits, a schema tweak added
  weeks after the fact, occasional `TODO`s, naming inconsistencies
- Review and edit generated code before committing rather than using it as-is
- Avoid uniformly polished comments/docstrings on every single function

---

## 10. Portfolio / Interview Talking Points This Project Demonstrates

- Multi-tenant relational schema design (org-scoped, FKs, enums, indexing)
- REST API design with auth/role scoping
- Local LLM/SLM inference integration + structured-output validation
- ETL pipeline design: extract/transform/load, incremental loads, idempotency
- OLTP vs OLAP schema design (fact/dimension modeling)
- Path to orchestration (Airflow/Dagster) and transformation tooling (dbt)

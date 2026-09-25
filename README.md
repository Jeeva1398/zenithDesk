# ZenithDesk

[![CI](https://github.com/Jeeva1398/zenithDesk/actions/workflows/ci.yml/badge.svg)](https://github.com/Jeeva1398/zenithDesk/actions/workflows/ci.yml)

A small-scale, multi-tenant SaaS support ticket system (Zendesk-style), built
to demonstrate full-stack engineering (React + Node + MySQL) and data
engineering (ETL, warehouse modeling, analytics) skills.

Customers can create tickets through a normal form or through an AI chatbot
that extracts structured ticket data from natural conversation.

The full architecture, schema and phased build plan are kept in
`ZenithDesk-Architecture-Context.md`, alongside the repo rather than in it.

## Project structure

- `server/` - Node.js + Express REST API, MySQL via `mysql2`
- `client/` - React (Vite) agent dashboard
- `e2e/` - Playwright end-to-end and API tests

## Setup

### Server

```bash
cd server
cp .env.example .env   # fill in your local MySQL credentials
npm install
npm run dev
```

The API starts on `http://localhost:3000` (or `PORT` from `.env`). A
`GET /health` route confirms the server is running.

### Client

```bash
cd client
npm install
npm run dev
```

## Tests

```bash
cd e2e
npm install
npx playwright install chromium   # first time only
npm test
```

The suite creates and migrates its own `zenithdesk_e2e` schema and runs the
API and client on their own ports, so your dev database and dev servers are
left alone. See [`e2e/README.md`](./e2e/README.md) for details. The same
suite, plus lint and a client build, runs on every push and pull request.

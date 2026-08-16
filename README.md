# ZenithDesk

A small-scale, multi-tenant SaaS support ticket system (Zendesk-style), built
to demonstrate full-stack engineering (React + Node + MySQL) and data
engineering (ETL, warehouse modeling, analytics) skills.

Customers can create tickets through a normal form or through an AI chatbot
that extracts structured ticket data from natural conversation.

See [`support-ticket-system-architecture.md`](./support-ticket-system-architecture.md)
for the full architecture, schema, and phased build plan.

## Project structure

- `server/` — Node.js + Express REST API, MySQL via `mysql2`
- `client/` — React (Vite) agent dashboard

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

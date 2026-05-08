# Docker development stack

Optional local Postgres + LangGraph backend + Next.js frontend, all on `localhost`. Used only for local development; production runs on Vercel + Supabase.

## Usage

Run from the **repo root** (so paths inside the compose files resolve against the right context) using the `--project-directory` flag:

```bash
# Production-like local stack
docker compose -f docker/docker-compose.yml --project-directory . up --build

# Hot-reload dev stack (mounts ./backend and ./frontend into the containers)
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml --project-directory . up --build
```

The `--project-directory .` flag tells Compose that relative paths (e.g. `./backend`, `./migrations`) resolve against the repo root, not against `docker/`.

## What's included

- `postgres` — Postgres 15 with the initial schema seeded from `migrations/001_initial_schema.sql`
- `backend` — LangGraph runtime on port 54367 (built from `backend/Dockerfile`)
- `frontend` — Next.js dev server on port 3000 (built from `frontend/Dockerfile`)

If you only need a database, the simpler path is `docker run` for Postgres + `yarn langgraph:in_mem:up` + `cd frontend && pnpm dev` for everything else.

# pointout-server

Self-hostable relay for [PointOut](../../README.md). Each freelancer runs their own instance (one server can serve many client projects, distinguished by `project` id) — nobody's demo depends on a shared, third-party service.

Stores annotations in SQLite (via `better-sqlite3`), broadcasts changes to every connected browser (client + developer) over WebSocket, and works behind any reverse proxy / static host combination (VPS, Render, Railway, Fly.io, your own Docker host...).

## Run locally

```bash
cd packages/server
cp .env.example .env   # edit POINTOUT_API_KEY
npm install
npm run dev
```

Server listens on `http://localhost:8787` (REST) and `ws://localhost:8787/ws` (real-time).

## Run with Docker

```bash
cd packages/server
docker compose up --build
```

Annotations persist in the `pointout-data` volume (SQLite file), so they survive restarts and redeploys.

## Deploying next to a static demo site

The demo site itself (Vercel, Wix, a plain VPS, anything) never needs a backend — it just needs `pointout-sdk` pointed at your relay's public URL:

1. Deploy this server somewhere reachable over HTTPS/WSS (a small VPS, Render, Railway, Fly.io — a single free/low-tier instance is enough for most freelance workloads).
2. Set `POINTOUT_API_KEY` to a long random secret and `POINTOUT_CORS_ORIGINS` to the domain(s) of the demo sites that should be allowed to connect.
3. Point the widget's `server` config at the deployed URL and use the same `token`.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8787` | HTTP/WS port |
| `POINTOUT_API_KEY` | _(none)_ | Shared secret required from connecting clients. Leave empty only for local testing. |
| `POINTOUT_CORS_ORIGINS` | `*` | Comma-separated list of allowed origins for the REST API |
| `POINTOUT_DB_PATH` | `./data/pointout.db` | SQLite file location |

## REST API

- `GET /api/health` — liveness check.
- `GET /api/projects/:project/annotations` — snapshot of stored annotations + overlay visibility (requires `x-api-key` header or `?token=` when `POINTOUT_API_KEY` is set).

## WebSocket protocol (`/ws?project=&token=&role=&name=`)

Messages exchanged as JSON: `{type:'snapshot'|'add'|'update'|'remove'|'visibility', ...}`. See [ws.js](src/ws.js) for the exact shapes — they mirror the `Annotation` type used by `pointout-sdk`.

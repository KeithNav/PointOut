# PointOut repository instructions

## Workspace commands

- Use Node.js 18 or newer; CI and the Docker image use Node.js 20.
- Install workspace dependencies from the repository root with `npm install` (or `npm ci` when using the lockfile in a clean environment).
- Build the publishable browser SDK: `npm run build` or `npm run build --workspace packages/core`. This runs TypeScript declaration generation and Vite, producing ESM, CJS, and IIFE bundles in `packages/core/dist/`.
- Watch SDK builds: `npm run dev:core`.
- Run the relay: `npm run dev:server` (Node watch mode) or `npm run start --workspace packages/server`.
- The server has no build step. Validate its entry modules with:
  ```bash
  npm run build --workspace packages/core
  node --check src/index.js
  node --check src/db.js
  node --check src/ws.js
  node --check src/routes.js
  ```
  Run the `node --check` commands from `packages/server`.
- There is currently no test runner, single-test command, or lint script. Do not invent test selectors; use the targeted build and syntax checks above.

## Architecture

PointOut is an npm workspace with two independently deployable parts:

- `packages/core` is the framework-agnostic browser SDK. `PointOut.init()` creates an `Overlay` inside a Shadow DOM host so its UI and `styles.ts` do not inherit host-page styles. The overlay emits creation, update, deletion, and visibility callbacks; `PointOut.ts` owns the in-memory page-filtered annotation map, optimistic UI updates, event subscriptions, and transport selection.
- `packages/core/src/transport` defines the transport boundary. `WebSocketTransport` converts a configured HTTP(S) relay URL to WebSocket form, appends `/ws` and connection metadata, reconnects with backoff, and queues offline mutations. `LocalTransport` instead persists a project to `localStorage` and synchronizes browser tabs through the `storage` event.
- `packages/server` is the self-hosted Express/WebSocket relay. `index.js` mounts REST routes under `/api` and attaches the WebSocket server at `/ws`; `db.js` persists annotations and project-wide visibility in SQLite; `ws.js` maintains in-memory connection rooms keyed by project and broadcasts stored mutations to peers.

The shared contract is the TypeScript `Annotation` and `ServerMessage` definitions in `packages/core/src/types.ts`. WebSocket messages are `snapshot`, `add`, `update`, `remove`, and `visibility`; keep server message shapes and SDK transport handling aligned whenever that contract changes. The relay snapshots all annotations for a project, while the SDK filters them to `location.pathname`, so `project` scopes collaboration and `page` scopes rendered annotations.

## Project-specific conventions

- Browser annotations use document-pixel coordinates (`coordinateSpace: 'document'`) so drawing can cover the full scrollable document. Rendering deliberately supports legacy annotations without that field as percentage coordinates; preserve this compatibility when changing geometry or persistence.
- The overlay is built with DOM and SVG APIs rather than a UI framework. Keep visible UI, SVG rendering, and interaction behavior inside `Overlay.ts`; use its callback interface to route state changes through `PointOut.ts` and the selected `Transport`.
- Apply local mutations optimistically in `PointOut.ts` before sending them. The relay broadcasts mutations to other clients while excluding the sender, so removing those local updates makes the initiating UI stale.
- `project` must be stable and identical for collaborators; `page` must remain the browser pathname captured by the SDK. Do not move page filtering into the relay without accounting for the REST project snapshot endpoint.
- A developer role can resolve annotations and set project visibility. The relay enforces the visibility restriction based on the WebSocket connection role; keep any new privileged protocol operation enforced server-side as well as in the overlay UI.
- Server authentication is optional only when `POINTOUT_API_KEY` is empty. REST uses `x-api-key` or `?token=`, while WebSocket authentication uses `token` in the connection query. Keep these paths consistent with widget configuration and deployment documentation.
- The example loads the locally built IIFE bundle and expects the relay on port 8787. For end-to-end manual checks, build the core package, run the relay with `packages/server/.env`, serve the repository over HTTP (for example `npx serve . -l 5500`), then open `examples/plain-html/demo.html` as both the default client and `?role=developer`.
- Keep package documentation and `docs/INTEGRATION.md` synchronized with public SDK configuration, relay environment variables, REST/WebSocket behavior, and generated bundle names.

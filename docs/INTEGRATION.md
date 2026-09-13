# PointOut integration and deployment

This guide shows how to add PointOut to an existing demo website. You do not need to rewrite the website's backend. You connect two separate parts:

1. **PointOut relay** - a small Node.js service that stores feedback and shares it in real time.
2. **PointOut browser widget** - a JavaScript file that you load into the demo website.

One relay server can serve multiple client projects. The `project` identifier keeps each project's data separate.

## Before you start

You will need:

- Node.js 18+ and npm in the project where you install PointOut;
- a public HTTPS domain for the relay, for example `https://pointout.example.com`;
- the public URL of the demo website, for example `https://demo.client.com`.

> [!IMPORTANT]
> An HTTPS demo website can only connect to an HTTPS/WSS relay. Use `ws://` only for local development; browsers block it on a live `https://` page.

## Quick local test

Use this to verify the setup on your own machine before deploying it.

```bash
# From the repository root
npm install
npm run build --workspace packages/core

# In another terminal
cd packages/server
cp .env.example .env
npm install
npm run dev
```

The relay now runs at `http://localhost:8787`. Open the [`examples/plain-html/demo.html`](../examples/plain-html/demo.html) example through an HTTP server, not directly as a `file://` URL:

```bash
# From the repository root, in a third terminal
npx serve . -l 5500
```

Then open:

- as the client: `http://localhost:5500/examples/plain-html/demo.html`
- as the developer: `http://localhost:5500/examples/plain-html/demo.html?role=developer`

Draw something in either view. It should immediately appear in the other one.

## Deploy the relay with Docker

This is the recommended, platform-agnostic path. It works on your own VPS and on any host that can run a Docker container, provide persistent storage, and assign a public HTTPS URL.

### 1. Create the environment configuration

Clone the repository on the server, then create a `.env` file in `packages/server`:

```bash
cd packages/server
cp .env.example .env
```

Set at least these values:

```dotenv
PORT=8787
POINTOUT_API_KEY=put-a-long-random-secret-here
POINTOUT_CORS_ORIGINS=https://demo.client.com
POINTOUT_DB_PATH=./data/pointout.db
```

For multiple demo domains, separate them with commas and no spaces:

```dotenv
POINTOUT_CORS_ORIGINS=https://demo.client.com,https://another-demo.client.com
```

Generate a secret, for example:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not leave `POINTOUT_API_KEY` empty, and do not use the example `local-dev-secret` or `change-me` values in production.

### 2. Start the container

```bash
docker compose up -d --build
docker compose ps
```

The included Compose configuration stores the SQLite database in the `pointout-data` Docker volume, so annotations survive restarts and redeployments.

Check it from the same server:

```bash
curl http://localhost:8787/api/health
```

The expected response is `{"ok":true}`.

### 3. Give the relay an HTTPS URL

The PointOut relay listens on HTTP port `8787` by default. Put it behind a reverse proxy and forward all traffic, including the `/ws` WebSocket route, to `127.0.0.1:8787`.

Example Caddy configuration:

```caddyfile
pointout.example.com {
    reverse_proxy 127.0.0.1:8787
}
```

Caddy handles TLS certificates and WebSocket proxying automatically. With Nginx, Traefik, Render, Railway, or Fly.io, the same essentials apply: use persistent storage for `/app/data` and make the container reachable through the public `https://pointout.example.com` URL.

Check it publicly as well:

```bash
curl https://pointout.example.com/api/health
```

> [!NOTE]
> `POINTOUT_CORS_ORIGINS` limits browser CORS responses for the REST API. `POINTOUT_API_KEY` protects access to the relay. The secret is still present in the browser widget configuration, so use PointOut only for non-sensitive demo feedback and protect access to the demo website separately.

## Add the widget to the demo website

### 1. Install the SDK from npm (recommended)

From your website project's directory:

```bash
npm install @keithnav/pointout-sdk
```

Then initialize it in a browser-only entry point:

```js
import PointOut from '@keithnav/pointout-sdk';

PointOut.init({
  project: 'acme-website-2026',
  server: 'https://pointout.example.com',
  token: 'put-a-long-random-secret-here',
  user: { name: 'Client', role: 'client' },
});
```

For React, Vue, Next.js, and Vite placement details, see [Frameworks](#frameworks).

### 2. Use the CDN with no build setup

Use this option for plain HTML, WordPress, Webflow, Wix, or any site where adding npm dependencies is not practical. Place it just before the closing `</body>` tag:

```html
<script src="https://unpkg.com/@keithnav/pointout-sdk@0.1.0/dist/pointout.iife.js"></script>
<script>
  const isDeveloper =
    new URLSearchParams(window.location.search).get('po_role') === 'developer';

  PointOut.init({
    // A unique, stable identifier. Everyone collaborating must use the same one.
    project: 'acme-website-2026',
    // The public HTTPS URL of your relay.
    server: 'https://pointout.example.com',
    // Must exactly match POINTOUT_API_KEY on the relay.
    token: 'put-a-long-random-secret-here',
    user: {
      name: isDeveloper ? 'Developer' : 'Client',
      role: isDeveloper ? 'developer' : 'client',
    },
  });
</script>
```

The URL is pinned to `0.1.0`, so a later SDK release cannot unexpectedly change your production demo. Update that version deliberately when you are ready to adopt a new release.

### 3. Build the browser file from source

Use this only if you want to modify PointOut itself or cannot use npm/CDN distribution. From the PointOut repository root:

```bash
npm install
npm run build --workspace packages/core
```

This creates `packages/core/dist/pointout.iife.js`. Copy it into your website's public static directory, for example `public/pointout/pointout.iife.js`, then change the CDN script URL in the previous example to:

```html
<script src="/pointout/pointout.iife.js"></script>
```

Send the client the normal URL:

```text
https://demo.client.com
```

Open the developer view yourself:

```text
https://demo.client.com?po_role=developer
```

Both users see the same page and annotations. The `developer` role can mark feedback as resolved and hide the widget for everyone.

> [!WARNING]
> The `po_role=developer` query parameter only changes the widget's UI permissions; it is not access control. If you need real protection, secure the developer URL or the entire demo through your application's own authentication.

## Frameworks

### React, Next.js, and Vite

When using the installed npm package, initialization must run only in the browser. In React, `useEffect` is the right place:

```jsx
import { useEffect } from 'react';
import PointOut from '@keithnav/pointout-sdk';

export function PointOutFeedback() {
  useEffect(() => {
    const instance = PointOut.init({
      project: 'acme-website-2026',
      server: 'https://pointout.example.com',
      token: import.meta.env.VITE_POINTOUT_TOKEN,
      user: { name: 'Client', role: 'client' },
    });

    return () => instance.destroy();
  }, []);

  return null;
}
```

In the Next.js App Router, make this a client component with `'use client'`, and use a `NEXT_PUBLIC_`-prefixed variable for the token. These variables are included in browser JavaScript, so this is not a secret-management solution.

If you are not using the npm package, copy the built IIFE file to the `public` directory and load it with the HTML approach above. In Next.js, use `next/script`; in Vite or React, add a script tag to `index.html`.

### Vue 3

```vue
<script setup>
import { onMounted, onUnmounted } from 'vue';
import PointOut from '@keithnav/pointout-sdk';

let instance;

onMounted(() => {
  instance = PointOut.init({
    project: 'acme-website-2026',
    server: 'https://pointout.example.com',
    token: import.meta.env.VITE_POINTOUT_TOKEN,
    user: { name: 'Client', role: 'client' },
  });
});

onUnmounted(() => instance?.destroy());
</script>
```

### WordPress, Webflow, or Wix

Upload `pointout.iife.js` to hosting or a CDN that serves it over HTTPS. Then paste the HTML initialization snippet above into the page or project's **Custom Code / Footer Scripts** field, changing the script `src` to the public URL of the uploaded file. Enable it only on demo pages first, not across the entire public website.

## Configuration reference

| Setting | Required | Meaning |
| --- | --- | --- |
| `project` | Yes | A stable, unique project identifier. The same value means shared annotations. |
| `user.name` | Yes | The name shown next to annotations. |
| `user.role` | Yes | `'client'` or `'developer'`. Developers can resolve items and hide the widget globally. |
| `server` | Yes in production | Relay URL: `https://...`, `wss://...`, or locally `http://...` / `ws://...`. |
| `token` | When configured on the relay | The relay's `POINTOUT_API_KEY` value. |
| `mode` | No | `'server'` or `'local'`. Defaults to server mode when `server` exists; otherwise local mode. |
| `startVisible` | No | Set to `false` to load with the overlay hidden. Defaults to `true`. |
| `color` | No | Default annotation color, for example `'#ff4d4f'`. |

If you omit `server` and `token`, PointOut runs in `local` mode. Data is stored in `localStorage` and synced between tabs in the same browser. This is useful for a quick trial, but not for live collaboration between a client and developer.

## Pre-launch checklist

- [ ] `https://.../api/health` returns `{"ok":true}`.
- [ ] The relay is available through HTTPS and uses persistent storage for `/app/data`.
- [ ] The client and developer views use identical `project`, `server`, and `token` values.
- [ ] The demo domain is listed in `POINTOUT_CORS_ORIGINS`.
- [ ] The demo loads the widget over HTTPS and connects to an HTTPS/WSS relay.
- [ ] The client and developer see each other's new annotations from separate browsers or devices.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| The PO bubble does not appear | Open the browser console. Confirm that `pointout.iife.js` loads with a 200 response and that `PointOut.init(...)` runs. |
| Annotations do not sync | Compare the `project`, `server`, and `token` values in both views. Then check the relay's `https://.../api/health` endpoint and the `/ws` connection in the browser Network panel. |
| `401 Invalid API key` | The `token` does not match the relay's `POINTOUT_API_KEY`. After changing `.env`, restart the container with `docker compose up -d`. |
| CORS error | Add the demo's full origin, such as `https://demo.client.com` with no path, to `POINTOUT_CORS_ORIGINS`, then restart the relay. |
| WebSocket fails on an HTTPS site | Do not use a `ws://` URL. The relay's public URL must be `https://...` or `wss://...`, and the reverse proxy must forward the `/ws` route. |

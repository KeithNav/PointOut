# Integration guide

Step-by-step guide for adding PointOut to a real project, whatever stack the demo site itself is built with.

## 1. Deploy the relay server once

You only need **one** relay server per developer/studio — it can serve every client project you run, distinguished by a `project` id. See [packages/server/README.md](../packages/server/README.md) for full details. Short version:

```bash
cd packages/server
cp .env.example .env      # set POINTOUT_API_KEY to a long random secret
npm install
npm run dev                # local test on http://localhost:8787
```

For a real client demo, deploy it somewhere reachable over HTTPS (a small VPS, Render, Railway, Fly.io...) using the provided [Dockerfile](../packages/server/Dockerfile)/[docker-compose.yml](../packages/server/docker-compose.yml), and set `POINTOUT_CORS_ORIGINS` to the demo site's domain.

## 2. Add the SDK to the demo site

Two ways to install, pick whichever fits the project:

### Option A — plain `<script>` tag (any static site, WordPress, Wix, Webflow...)

```html
<script src="https://unpkg.com/pointout-sdk/dist/pointout.iife.js"></script>
<script>
  PointOut.init({
    project: 'acme-redesign',
    server: 'https://your-relay.example.com',
    token: 'your-shared-secret',
    user: { name: 'Jane', role: 'client' },
  });
</script>
```

### Option B — npm package (React, Vue, Next.js, Nuxt, any bundler-based project)

```bash
npm install pointout-sdk
```

```js
import PointOut from 'pointout-sdk';

PointOut.init({
  project: 'acme-redesign',
  server: 'https://your-relay.example.com',
  token: 'your-shared-secret',
  user: { name: 'Jane', role: 'client' },
});
```

## 3. Configuration reference

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `project` | `string` | yes | Identifies which demo/client project the annotations belong to. Reuse the same relay server across projects by giving each one a unique id. |
| `user` | `{ name: string; role: 'client' \| 'developer' }` | yes | Who is viewing. Developers get extra rights (resolve, force-hide for everyone). |
| `server` | `string` | no | URL of your self-hosted relay (`https://...` or `ws://...`). Omit to run in `local` mode (see below). |
| `token` | `string` | no | Must match `POINTOUT_API_KEY` on the relay server. |
| `mode` | `'server' \| 'local'` | no | Defaults to `'server'` when `server` is set, otherwise `'local'`. |
| `startVisible` | `boolean` | no | Whether the overlay is expanded on load. Defaults to `true`. |
| `color` | `string` | no | Default annotation color (hex). Defaults to `#ff4d4f`. Each user can still change it from the toolbar's color picker. |

## 4. Client vs. developer role

Set `user.role` to `'client'` on the link you send your client, and `'developer'` on your own copy (or a separate internal-only URL/branch). Both roles can draw and comment; only `'developer'` can mark items **resolved** and force the overlay's visibility for everyone (kill switch).

A common pattern is to add a harmless query param and read it into the config:

```js
const isDeveloper = new URLSearchParams(location.search).get('po_role') === 'dev';

PointOut.init({
  project: 'acme-redesign',
  server: 'https://your-relay.example.com',
  token: 'your-shared-secret',
  user: { name: isDeveloper ? 'You' : 'Client', role: isDeveloper ? 'developer' : 'client' },
});
```

Then you browse the demo with `?po_role=dev` and send the client the plain URL.

## 5. Framework-specific snippets

**React**

```jsx
import { useEffect } from 'react';
import PointOut from 'pointout-sdk';

function App() {
  useEffect(() => {
    const instance = PointOut.init({
      project: 'acme-redesign',
      server: 'https://your-relay.example.com',
      token: 'your-shared-secret',
      user: { name: 'Jane', role: 'client' },
    });
    return () => instance.destroy();
  }, []);

  return <YourApp />;
}
```

**Vue 3**

```vue
<script setup>
import { onMounted, onUnmounted } from 'vue';
import PointOut from 'pointout-sdk';

let instance;
onMounted(() => {
  instance = PointOut.init({
    project: 'acme-redesign',
    server: 'https://your-relay.example.com',
    token: 'your-shared-secret',
    user: { name: 'Jane', role: 'client' },
  });
});
onUnmounted(() => instance?.destroy());
</script>
```

**WordPress**

Paste the `<script>` snippet from Option A into a "footer scripts" field (e.g. via the *Insert Headers and Footers* plugin, or your theme's `footer.php` before `</body>`).

**Wix / Webflow**

Both offer a "Custom Code" panel (Wix: Settings → Custom Code; Webflow: Project Settings → Custom Code) where you can paste the same `<script>` snippet to run on specific pages or the whole site.

## 6. Going to production

- Serve the relay over **HTTPS/WSS** — browsers block `ws://` connections from an `https://` page (mixed content).
- Set a long, random `POINTOUT_API_KEY` and restrict `POINTOUT_CORS_ORIGINS` to your actual demo domain(s).
- Once the project ships, call `instance.hide()` or click **Hide** in the toolbar — or have the developer toggle visibility off for everyone from their own session.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Overlay bubble doesn't appear | Script didn't load (check the `<script src>` path/CDN), or `PointOut.init` wasn't called. |
| Annotations don't sync between client/developer | Different `project` ids, mismatched `token`, or the relay server isn't reachable (check browser console/network tab for WebSocket errors). |
| Browser console shows a CORS error | Add the demo site's exact origin to `POINTOUT_CORS_ORIGINS` on the relay server. |
| WebSocket connection fails on an HTTPS site | Use `wss://` (or plain `https://`, the SDK upgrades it automatically) — not `ws://`, once the relay is served over TLS. |

# @keithnav/pointout-sdk

The client-side widget of [PointOut](../../README.md) — an open-source overlay that lets clients draw pins, shapes, arrows and notes directly on a live demo page, synced in real time to the developer.

## Install

```bash
npm install @keithnav/pointout-sdk
```

```js
import PointOut from '@keithnav/pointout-sdk';

PointOut.init({
  project: 'acme-redesign',
  server: 'https://pointout.your-domain.com', // your self-hosted relay (see packages/server)
  token: 'your-shared-secret',
  user: { name: 'Jane', role: 'client' }, // or role: 'developer'
});
```

## Or just a `<script>` tag (no build step)

```html
<script src="https://unpkg.com/@keithnav/pointout-sdk@0.1.0/dist/pointout.iife.js"></script>
<script>
  PointOut.init({
    project: 'acme-redesign',
    server: 'https://pointout.your-domain.com',
    token: 'your-shared-secret',
    user: { name: 'Jane', role: 'client' },
  });
</script>
```

## No backend yet?

Omit `server` to run in `local` mode — annotations are kept in `localStorage` and synced across tabs of the same browser. Great for trying the widget out before deploying the relay server.

See the [full integration guide](../../docs/INTEGRATION.md) for framework-specific snippets (React, Vue, WordPress, Wix, Webflow) and a config reference table.

## API

- `PointOut.init(config)` — mounts the overlay, returns an instance.
- `instance.show()` / `.hide()` / `.toggle()` — control overlay visibility.
- `instance.setTool('pin' | 'rect' | 'arrow' | 'pen' | 'text' | 'pointer')` — pre-select a tool.
- `instance.on('annotation:add' | 'annotation:update' | 'annotation:remove' | 'visibility', callback)` — hook into events (e.g. to build a custom feedback dashboard).
- `instance.destroy()` — unmounts the overlay.

## Build

```bash
npm run build --workspace packages/core
```

Outputs `dist/pointout.mjs` (ESM), `dist/pointout.cjs` (CJS) and `dist/pointout.iife.js` (global `window.PointOut`, for plain `<script>` usage).

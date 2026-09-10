# Plain HTML example

Demonstrates the simplest possible integration — a static page with a single `<script>` tag, no build step, no framework.

The key idea: **there is only one URL**. The developer sends the client that exact link; the developer opens the same link with `?role=developer` added. Because it's the same page path, both sides see and create the same annotations live — only the query param differs, which changes the toolbar rights (resolve/delete) but not what's visible.

## Run it

```bash
# 1. Build the SDK once
npm install
npm run build --workspace packages/core

# 2. Start the relay server (in another terminal)
cd packages/server
cp .env.example .env
npm install
npm run dev

# 3. Serve this folder (or the whole repo) over HTTP — file:// won't work across two devices.
#    From the repo root: npx serve . -l 5500

# 4. Open in two browsers/devices on the same network:
#    - http://<your-ip>:5500/examples/plain-html/demo.html               (client)
#    - http://<your-ip>:5500/examples/plain-html/demo.html?role=developer (developer)
```

Draw something as the client and watch it appear instantly for the developer, and vice versa.

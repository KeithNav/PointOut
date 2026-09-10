# Plain HTML example

Demonstrates the simplest possible integration — a static page with a single `<script>` tag, no build step, no framework.

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

# 3. Open both files in a browser
#    - examples/plain-html/client.html
#    - examples/plain-html/developer.html
```

Draw something in `client.html` and watch it appear instantly in `developer.html`, and vice versa.

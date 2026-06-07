# Railway Deploy - TabStash AI Server

## Service

Railway Service: server only

Railway should deploy only the backend API service. The Chrome extension is built separately and should not be deployed as part of this Railway service.

## Root Directory

Recommended Railway setup:

```text
server
```

This repository also includes a root `railway.json` fallback for monorepo deployments. If Railway is deploying from the repository root instead of `server`, it should use:

```bash
npm install --include=dev && npm run build --workspace server
```

and:

```bash
npm run start --workspace server
```

## Build Command

```bash
npm install --include=dev && npm run build
```

## Start Command

```bash
npm run start
```

## Required Variables

```bash
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-chat
DATABASE_URL=...
```

## Networking

Use the port your app logs at startup.

The app reads `process.env.PORT` and falls back to `8787` locally.

Railway injects `PORT` at runtime. The server binds to `0.0.0.0` and logs the active port:

```text
TabStash API listening on 0.0.0.0:<port>
```

## Health Check

After deployment, verify:

```bash
curl https://server-production-2787.up.railway.app/health
```

Expected response:

```json
{"ok":true}
```

## Local Production Simulation

From the `server` directory:

```bash
npm install
npm run build
test -f dist/index.js
npm run start:prod:test
```

`start:prod:test` starts the production server and blocks the terminal. Stop it with `Ctrl+C` after confirming the startup log and `/health` response.

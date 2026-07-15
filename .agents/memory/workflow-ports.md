---
name: Workflow PORT requirement
description: Artifact workflows must hardcode PORT in the command string; $PORT is not injected at workflow start time.
---

When configuring workflows via `configureWorkflow()`, the `$PORT` env variable is not automatically set even though `artifact.toml` declares `PORT` under `[services.env]`.

**Fix:** Hardcode the port directly in the workflow command:
- API server: `PORT=8080 pnpm --filter @workspace/api-server run dev`
- Mobile/Expo: `PORT=18115 pnpm --filter @workspace/mobile run dev`

**Why:** The artifact.toml `[services.env]` block only applies to production/managed service runs, not to the dev workflow shell command.

**How to apply:** Any new artifact dev workflow must prefix the command with `PORT=<localPort>` matching the `localPort` declared in `artifact.toml`.

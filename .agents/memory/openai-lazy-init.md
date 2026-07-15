---
name: OpenAI lazy init pattern
description: All AI clients in lib/integrations-openai-ai-server use lazy initialization; OPENAI_API_KEY replaces Replit proxy env vars.
---

The original code used `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` from Replit's AI integration proxy. The user wants the app to run independently without Replit's internal AI infrastructure.

**Fix:** Replaced all three client files in `lib/integrations-openai-ai-server/src/`:
- `client.ts` — uses a Proxy for lazy OpenAI init; reads `process.env.OPENAI_API_KEY`
- `image/client.ts` — `getClient()` factory function called inside each exported async function
- `audio/client.ts` — same `getClient()` pattern

**Why:** Eager-throw at module load time crashed the API server on startup even when AI features weren't used. Lazy init lets the server start without the key and only fails when an AI endpoint is actually called.

**How to apply:** Any new AI client files should use the lazy `getClient()` pattern. The secret is named `OPENAI_API_KEY` (set it as a Replit Secret). The user wants to choose their own AI model — future work should expose model selection.

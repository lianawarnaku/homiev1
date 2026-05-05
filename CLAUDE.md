# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Homie** — a roommate home management mobile app. Expo/React Native frontend with an Express API backend, structured as a pnpm workspace monorepo.

## Commands

```bash
# Typecheck everything
pnpm run typecheck

# Build everything
pnpm run build

# Run mobile dev server
pnpm --filter @workspace/mobile run dev

# Run API server (dev)
pnpm --filter @workspace/api-server run dev

# Regenerate API client hooks + Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema to PostgreSQL
pnpm --filter @workspace/db run push
```

No test runner is configured yet.

## Architecture

```
artifacts/
  mobile/          # Expo React Native app (@workspace/mobile)
  api-server/      # Express 5 backend (@workspace/api-server)
lib/
  db/              # Drizzle ORM + PostgreSQL schema (@workspace/db)
  api-spec/        # OpenAPI 3.1 spec + Orval codegen config
  api-client-react/  # Generated React Query hooks (do not edit by hand)
  api-zod/           # Generated Zod schemas (do not edit by hand)
  integrations-openai-ai-server/  # OpenAI wrapper for server use
  integrations-openai-ai-react/   # OpenAI React integration
```

**State management:** All app state and types live in `artifacts/mobile/context/AppContext.tsx`, persisted to AsyncStorage. There is no Redux or Zustand — use the existing context pattern for new state.

**API layer:** The OpenAPI spec (`lib/api-spec/openapi.yaml`) is the source of truth. Orval generates React Query hooks into `lib/api-client-react/` and Zod schemas into `lib/api-zod/` — always edit the spec, then run codegen rather than editing generated files directly.

**AI endpoint:** `POST /api/planning/suggest` in `artifacts/api-server/src/routes/planning.ts` — accepts `{ type: "chore-chart" | "home-checklist", preferences?, roommates? }`, calls OpenAI gpt-5-mini via Replit AI proxy.

## Mobile App Structure

Six tabs under `artifacts/mobile/app/(tabs)/`:

| Tab | File | Feature |
|-----|------|---------|
| My Chores | `index.tsx` | Personal chore tracking with points & categories |
| Group Chores | `group.tsx` | All roommates' tasks + Room Health indicator |
| Expenses | `expenses.tsx` | Shared expense tracker + shopping list |
| Planning | `planning.tsx` | AI-powered chore chart & checklist generator |
| Borrowing Buddy | `borrowing.tsx` | Borrowed items with due dates |
| Leaderboard | `leaderboard.tsx` | Gamified rankings with badges |

Sample data seeds 6 roommates: Roha, Liana, Safa, Akshaya, Sumaiya, Esha.

## Key Files

- `artifacts/mobile/context/AppContext.tsx` — all types, state, and AsyncStorage persistence
- `artifacts/mobile/constants/colors.ts` — design tokens (blue `#4F7FF7`, green `#22C55E`, orange `#F59E0B`)
- `artifacts/api-server/src/routes/planning.ts` — AI integration example

## Design Conventions

- Light theme only; Inter font (400/500/600/700)
- Icons: `@expo/vector-icons` — Feather set generally, SF Symbols on iOS where available
- TypeScript strict mode; Zod (`zod/v4`) for all validation
- API server bundles to ESM via esbuild; mobile uses Expo's Metro bundler with React Compiler enabled

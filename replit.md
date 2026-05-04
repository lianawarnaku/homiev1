# HomeBase - Roommate Management App

## Overview

A comprehensive mobile app (Expo/React Native) for roommate home management — built as a pnpm workspace monorepo with an Express API backend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Mobile**: Expo (React Native) with Expo Router
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (provisioned, not used yet)
- **AI**: OpenAI via Replit AI Integrations (Planning Helper)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## App Features (6 Tabs)

1. **My Chores** - Personal chore tracking with points, categories, filters, FAB to add
2. **Group Chores** - All roommates' tasks, Room Health indicator, anonymous nudge feature
3. **Expenses** - Shared expense tracker, balance calculator, Shopping List with checkboxes
4. **Planning** - AI-powered chore chart generator and home essentials checklist (OpenAI)
5. **Borrowing Buddy** - Track borrowed items with due date reminders and return confirmation
6. **Leaderboard** - Gamified rankings with podium, weekly/all-time toggle, Roommate Fairy badges

## Architecture

- **Mobile app**: `artifacts/mobile/` — Expo app with `@workspace/mobile`
- **API server**: `artifacts/api-server/` — Express server at `/api`
- **State management**: React Context (`context/AppContext.tsx`) + AsyncStorage
- **AI integration**: `lib/integrations-openai-ai-server/` via Replit AI proxy
- **Sample data**: Pre-seeded with 4 roommates (Alex, Jordan, Sam, Riley) and sample data

## Key Files

- `artifacts/mobile/context/AppContext.tsx` — All types, state, and AsyncStorage persistence
- `artifacts/mobile/constants/colors.ts` — Design tokens (blue/green/orange palette)
- `artifacts/mobile/app/(tabs)/` — All 6 tab screens
- `artifacts/api-server/src/routes/planning.ts` — AI planning endpoint (POST /api/planning/suggest)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## AI Planning Endpoint

`POST /api/planning/suggest`
- Body: `{ type: "chore-chart" | "home-checklist", preferences?: string, roommates?: string[] }`
- Response: `{ suggestion: string }`
- Uses OpenAI gpt-5-mini via Replit AI Integrations

## Design

- Color palette: Blue primary (#4F7FF7), green success (#22C55E), orange warning (#F59E0B)
- Font: Inter (400/500/600/700)
- Light theme only
- Icons: @expo/vector-icons (Feather + SF Symbols on iOS)

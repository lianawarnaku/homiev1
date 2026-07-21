---
name: Supabase + auth architecture
description: Supabase project details, auth flow, routing structure, and data layer for the Homie app.
---

## Supabase project
- Project ID: eqnogaftebuqfwwelbdx
- URL: https://eqnogaftebuqfwwelbdx.supabase.co
- Env vars set (shared): SUPABASE_URL, SUPABASE_ANON_KEY, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_GOOGLE_CLIENT_ID
- Secrets: GOOGLE_OAUTH_CLIENT_SECRET (Replit secret; must also be entered in Supabase dashboard > Auth > Providers > Google)

## Auth routing structure
- `artifacts/mobile/app/index.tsx` — 3-way gate: no session → (auth)/splash, session + no household → (onboarding), session + household → (tabs)
- `artifacts/mobile/app/(auth)/` — splash, login, register screens
- `artifacts/mobile/app/(onboarding)/` — index (create/join choice), create (4-step wizard), join (invite code)
- `artifacts/mobile/context/AuthContext.tsx` — wraps Supabase session; `useAuth()` hook
- `artifacts/mobile/context/HouseholdContext.tsx` — fetches household + membership; `useHousehold()` hook
- `artifacts/mobile/context/AppContext.tsx` — all entity data (chores, expenses, etc.); `useAppContext()` hook
- `artifacts/mobile/lib/supabase.ts` — Supabase client using AsyncStorage for session persistence

## Auth methods implemented
- Email/password: fully working
- Google OAuth: UI built; needs Supabase dashboard configured (client ID + secret) + redirect URL added in Google Cloud Console
- Apple: deferred

## Database schema (all tables live in Supabase)
Phase 3: households, household_members, household_amenities, + is_household_member() + find_household_by_code() RPC
Phase 4: chores, expenses, shopping_lists, shopping_items, borrow_items, nudges + points/weekly_points on household_members

## Data layer (AppContext)
- All 6 entities backed by Supabase (no AsyncStorage for entity data)
- Optimistic updates: local state updated immediately, Supabase call follows async
- essentialsAssignees: still in AsyncStorage (device-local preference, key: homebase_essentials_v1)
- nudges, suppressedAlerts, roommateStatuses, homeLocation: in-memory only (Phase 5 will sync)
- useAppContext() is the exported hook (alias for useApp); tab screens import this name

## Design tokens for auth/onboarding screens
- Background: #FDFAF6 (warm off-white)
- Brown primary: #8D5524
- Dark text: #1A120B
- Muted text: #7A6652
- Border: #E2D5C8

## Logo
- Component: `artifacts/mobile/components/HomieLogomark.tsx`
- 4 brown rounded square tiles + 1 brown rounded triangle tile (roof)
- Uses react-native-svg (Path + Rect with rx/ry=4)
- Default color: #8D5524, default size: 80

## Next phase
- Phase 5: Supabase Realtime subscriptions for live cross-device sync (chores, expenses, shopping, borrow)

**Why Supabase over Replit DB:** User wants independence from Replit infrastructure for portability.

---
name: Supabase + auth architecture
description: Supabase project details, auth flow, and screen routing for the Homie app.
---

## Supabase project
- Project ID: eqnogaftebuqfwwelbdx
- URL: https://eqnogaftebuqfwwelbdx.supabase.co
- Env vars set (shared): SUPABASE_URL, SUPABASE_ANON_KEY, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_GOOGLE_CLIENT_ID
- Secrets: GOOGLE_OAUTH_CLIENT_SECRET (Replit secret; must also be entered in Supabase dashboard > Auth > Providers > Google)

## Auth routing structure
- `artifacts/mobile/app/index.tsx` — route guard: loading spinner → redirect to `/(auth)/splash` (no session) or `/(tabs)` (has session)
- `artifacts/mobile/app/(auth)/` — splash, login, register screens
- `artifacts/mobile/context/AuthContext.tsx` — wraps Supabase session; `useAuth()` hook
- `artifacts/mobile/lib/supabase.ts` — Supabase client using AsyncStorage for session persistence

## Auth methods implemented
- Email/password: fully working
- Google OAuth: UI built; needs Supabase dashboard configured (client ID + secret) + redirect URL added in Google Cloud Console
- Apple: deferred (user has no Apple Developer account yet)

## Design tokens for auth screens
- Background: #FDFAF6 (warm off-white)
- Brown primary: #8D5524
- Dark text: #1A120B
- Muted text: #7A6652
- Border: #E2D5C8

## Logo
- Component: `artifacts/mobile/components/HomieLogomark.tsx`
- 4 brown square tiles + 1 brown triangle tile (roof), all meeting at center
- Uses react-native-svg (Polygon + Rect)
- Default color: #8D5524, default size: 80

## Next phases
- Phase 3: Household onboarding (create/join household, invite code + email invite)
- Phase 4: Data persistence (replace AsyncStorage with Supabase for all entities)
- Phase 5: Real-time sync (Supabase Realtime subscriptions)

**Why:** User wants all data in Supabase (not Replit DB) for independence from Replit infrastructure.

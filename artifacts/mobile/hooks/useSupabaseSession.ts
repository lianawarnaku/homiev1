// Tracks the current Supabase auth session and re-renders consumers whenever
// it changes. Wraps `onAuthStateChange` — the callback fires on sign-in,
// sign-out, token refresh, and initial session recovery from AsyncStorage.
//
// `loading` is true only for the very first tick while we retrieve the
// persisted session from AsyncStorage. After that it's false forever and
// `session` swaps between a Session object and null as the user signs in/out.

import { type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { reportSupabaseError } from "@/lib/runtimeDiagnostics";

export function useSupabaseSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Kick off the initial session lookup. AsyncStorage read is quick but
    // async, so we hold `loading` true until it resolves.
    let active = true;
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) reportSupabaseError("restore auth session", error);
        if (!active) return;
        setSession(data.session);
      })
      .catch((error) => reportSupabaseError("restore auth session", error))
      .finally(() => {
        if (active) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

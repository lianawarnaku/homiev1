import { supabase } from "./supabase";

// Base URL for the Express API. In deployment this is the app's own domain;
// empty string means same-origin (web).
const domain = process.env.EXPO_PUBLIC_DOMAIN;
export const apiBaseUrl = domain ? `https://${domain}` : "";

/**
 * Build headers for an authenticated API request. Attaches the current
 * Supabase access token as a Bearer token so the API server's requireAuth
 * middleware accepts the request.
 *
 * @param extra  Additional headers to merge (e.g. X-Google-Access-Token).
 */
export async function authHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

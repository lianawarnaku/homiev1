import type { Request, Response, NextFunction } from "express";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { logger } from "../lib/logger";

// Server-side Supabase client used ONLY to validate incoming access tokens.
// It uses the public anon key + URL (no service_role secret needed): the token
// itself carries the user's identity, and getUser() verifies its signature and
// expiry against the Supabase Auth server.
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;
if (supabaseUrl && supabaseAnonKey) {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
} else {
  logger.error(
    "[auth] SUPABASE_URL / SUPABASE_ANON_KEY not set — all authenticated routes will reject requests.",
  );
}

// Augment Express's Request so downstream handlers can read req.user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Express middleware that requires a valid Supabase access token.
 * Expects `Authorization: Bearer <access_token>`. On success attaches the
 * verified user to `req.user`; otherwise responds 401.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!client) {
    res.status(503).json({ error: "Auth not configured on server" });
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Empty bearer token" });
    return;
  }

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    req.user = data.user;
    next();
  } catch (err) {
    req.log.error({ err }, "Token verification failed");
    res.status(401).json({ error: "Token verification failed" });
  }
}

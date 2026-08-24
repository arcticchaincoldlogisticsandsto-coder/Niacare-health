import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';

/**
 * Vercel injects every configured project env var into serverless functions
 * regardless of the VITE_ prefix (that prefix only controls what Vite bundles
 * into the browser build) — so the same Supabase project vars set for the
 * client work here too, without needing a duplicate server-only copy.
 */
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

/**
 * Builds a Supabase client scoped to the calling user's own session (via
 * their access token), so all queries run under that user's normal RLS
 * policies — no service-role key needed, no ability to touch another
 * patient's rows.
 */
export const getUserScopedClient = (
  req: VercelRequest
): { client?: SupabaseClient; accessToken?: string; error?: string } => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { error: 'Supabase is not configured on the server.' };
  }

  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!accessToken) {
    return { error: 'Missing Authorization bearer token.' };
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { client, accessToken };
};

export const getAuthedUser = async (
  req: VercelRequest
): Promise<{ client?: SupabaseClient; userId?: string; error?: string }> => {
  const { client, error } = getUserScopedClient(req);
  if (error || !client) return { error };

  const { data, error: userError } = await client.auth.getUser();
  if (userError || !data?.user) return { error: userError?.message || 'Not authenticated.' };

  return { client, userId: data.user.id };
};

/**
 * Relying-party identity for the WebAuthn ceremony. Prefers explicit env
 * vars (needed for a custom production domain), otherwise derives sensible
 * defaults from the request's Origin header so it works out of the box on
 * Vercel preview URLs and local `vercel dev` without extra configuration.
 */
export const getRpConfig = (req: VercelRequest) => {
  const origin = (req.headers.origin as string) || process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';
  let rpID = process.env.WEBAUTHN_RP_ID;
  if (!rpID) {
    try {
      rpID = new URL(origin).hostname;
    } catch {
      rpID = 'localhost';
    }
  }
  const rpName = process.env.WEBAUTHN_RP_NAME || 'NiaCare Health';
  return { rpID, rpName, origin };
};

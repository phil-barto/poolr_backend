// Caller verification and client construction, shared by every edge function.
//
// The two-client posture:
//   - user-scoped client (requireUser): forwards the caller's JWT, so
//     auth.getUser() is trusted and queries respect RLS.
//   - service-role client (serviceClient): bypasses RLS; use only AFTER
//     requireUser and any business-rule checks. The key never leaves the server.

import { createClient, type SupabaseClient, type User } from "jsr:@supabase/supabase-js@2";
import { json } from "./http.ts";

// No generated Database types in this repo, so clients are untyped — same as
// calling createClient() inline. (ReturnType<typeof createClient> would
// collapse the Database generic to never and type all rows as never.)
// deno-lint-ignore no-explicit-any
type Client = SupabaseClient<any, any, any>;

/// Verify the caller's JWT. Returns the user + a user-scoped client, or a 401
/// `response` to return as-is:
///
///   const auth = await requireUser(req);
///   if ("response" in auth) return auth.response;
///   const { user, userClient } = auth;
export async function requireUser(
  req: Request,
): Promise<{ user: User; userClient: Client } | { response: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { response: json({ error: "Missing Authorization header" }, 401) };
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    return { response: json({ error: "Invalid session" }, 401) };
  }

  return { user, userClient };
}

/// Service-role client. Bypasses RLS — call only after requireUser succeeded
/// and business rules are checked.
export function serviceClient(): Client {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

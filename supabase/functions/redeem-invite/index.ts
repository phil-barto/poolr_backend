// redeem-invite — example of PRIVILEGED logic that does not belong in RLS/RPC.
//
// It runs work the calling user is not directly allowed to do (adding a row to a
// pool they are not yet a member of) only AFTER validating an invite code. This
// is the pattern for any multi-step / external-API / service-role work:
//   1. Verify the caller's JWT with a user-scoped client (respects RLS).
//   2. Apply business rules.
//   3. Use the service-role client to perform the privileged write.
//
// The service-role key bypasses RLS and must never leave the server.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { withSentry } from "../_shared/sentry.ts";

Deno.serve(withSentry(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  // User-scoped client: forwards the caller's JWT, so auth.getUser() is trusted.
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ error: "Invalid session" }, 401);
  }

  const { inviteCode } = await req.json().catch(() => ({}));
  if (!inviteCode || typeof inviteCode !== "string") {
    return json({ error: "inviteCode is required" }, 400);
  }

  // Service-role client: bypasses RLS. Use only after the checks above.
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Resolve the invite code to a pool. (Replace with your invites table.)
  const poolId = await resolveInvite(adminClient, inviteCode);
  if (!poolId) {
    return json({ error: "Invalid or expired invite" }, 404);
  }

  const { error: insertError } = await adminClient
    .from("pool_members")
    .upsert({ pool_id: poolId, member_id: user.id, role: "member" });

  if (insertError) {
    return json({ error: insertError.message }, 400);
  }

  return json({ poolId }, 200);
}));

// deno-lint-ignore no-explicit-any
async function resolveInvite(_admin: any, _code: string): Promise<string | null> {
  // TODO: look up `code` in an `invites` table, check expiry/usage, return pool_id.
  return null;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

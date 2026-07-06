// redeem-invite — example of PRIVILEGED logic that does not belong in RLS/RPC.
//
// It runs work the calling user is not directly allowed to do (adding a row to a
// pool they are not yet a member of) only AFTER validating an invite code. This
// is the pattern for any multi-step / external-API / service-role work:
//   1. Verify the caller's JWT with requireUser (user-scoped client, respects RLS).
//   2. Apply business rules.
//   3. Use serviceClient() to perform the privileged write.
//
// The service-role key bypasses RLS and must never leave the server.

import { requireUser, serviceClient } from "../_shared/auth.ts";
import { json, serveFunction } from "../_shared/http.ts";

serveFunction(async (req) => {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const { inviteCode } = await req.json().catch(() => ({}));
  if (!inviteCode || typeof inviteCode !== "string") {
    return json({ error: "inviteCode is required" }, 400);
  }

  // Service-role client: bypasses RLS. Use only after the checks above.
  const adminClient = serviceClient();

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
});

// deno-lint-ignore no-explicit-any
async function resolveInvite(_admin: any, _code: string): Promise<string | null> {
  // TODO: look up `code` in an `invites` table, check expiry/usage, return pool_id.
  return null;
}

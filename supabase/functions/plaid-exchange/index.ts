// plaid-exchange — step 2 of Plaid Link. Trades the Link SDK's public_token for a
// long-lived access_token and stores the connection. The access_token is a server
// credential: it is written with the service-role client and never returned.

import { requireUser, serviceClient } from "../_shared/auth.ts";
import { json, serveFunction } from "../_shared/http.ts";
import { plaidFetch } from "../_shared/plaid.ts";
import { type OnboardingStep } from "../_shared/onboarding.ts";

serveFunction(async (req) => {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const { publicToken } = await req.json().catch(() => ({}));
  if (!publicToken || typeof publicToken !== "string") {
    return json({ error: "publicToken is required" }, 400);
  }

  const exchanged = await plaidFetch("/item/public_token/exchange", {
    public_token: publicToken,
  });

  const adminClient = serviceClient();

  const { data: row, error: insertError } = await adminClient
    .from("bank_connections")
    .insert({
      user_id: user.id,
      provider: "plaid",
      // ponytail: sandbox stores the token as-is. Encrypt via Supabase Vault
      // (vault.create_secret / a SECURITY DEFINER reader) before production.
      access_token: exchanged.access_token,
    })
    .select("id, status")
    .single();

  if (insertError) {
    return json({ error: insertError.message }, 400);
  }

  // Token stored — now record the onboarding step. Real upsert (not ignoreDuplicates)
  // so an actual link flips a prior "skipped" row to honest completion. The gate
  // (onboarding-status) derives the next step from these rows.
  const { error: stepError } = await adminClient
    .from("onboarding_progress")
    .upsert(
      { user_id: user.id, step: "bank_linked" satisfies OnboardingStep, skipped: false },
      { onConflict: "user_id,step" },
    );
  if (stepError) {
    return json({ error: stepError.message }, 400);
  }

  return json({ connectionId: row.id, status: row.status }, 200);
});

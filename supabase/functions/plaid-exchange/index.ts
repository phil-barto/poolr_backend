// plaid-exchange — step 2 of Plaid Link. Trades the Link SDK's public_token for a
// long-lived access_token and stores the connection. The access_token is a server
// credential: it is written with the service-role client and never returned.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { withSentry } from "../_shared/sentry.ts";
import { plaidFetch } from "../_shared/plaid.ts";
import { type OnboardingStep } from "../_shared/onboarding.ts";

Deno.serve(withSentry(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ error: "Invalid session" }, 401);
  }

  const { publicToken } = await req.json().catch(() => ({}));
  if (!publicToken || typeof publicToken !== "string") {
    return json({ error: "publicToken is required" }, 400);
  }

  const exchanged = await plaidFetch("/item/public_token/exchange", {
    public_token: publicToken,
  });

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

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
}));

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

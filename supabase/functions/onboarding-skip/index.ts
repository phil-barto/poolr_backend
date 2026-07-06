// onboarding-skip — records a permanent skip for a skippable onboarding step.
// The table has zero client write grants; this function is the controlled write
// path (same posture as plaid-exchange). Skips never overwrite completions.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { withSentry } from "../_shared/sentry.ts";
import { SKIPPABLE_STEPS, type OnboardingStep } from "../_shared/onboarding.ts";

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

  const { step } = await req.json().catch(() => ({}));
  if (!SKIPPABLE_STEPS.includes(step)) {
    return json({ error: "Step is not skippable" }, 400);
  }
  const skippedStep: OnboardingStep = step;

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ignoreDuplicates: a skip never downgrades an existing completion row.
  const { error } = await adminClient
    .from("onboarding_progress")
    .upsert(
      { user_id: user.id, step: skippedStep, skipped: true },
      { onConflict: "user_id,step", ignoreDuplicates: true },
    );
  if (error) {
    return json({ error: error.message }, 400);
  }

  return json({ ok: true }, 200);
}));

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

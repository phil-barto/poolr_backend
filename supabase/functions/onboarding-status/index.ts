// onboarding-status — returns the caller's next incomplete onboarding step, or
// null when onboarding is done. The required-step list lives in
// _shared/onboarding.ts; the client routes to /onboarding/<step> blindly.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { withSentry } from "../_shared/sentry.ts";
import { REQUIRED_STEPS } from "../_shared/onboarding.ts";

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

  // RLS scopes the read to the caller's own rows; no service role needed.
  const { data: rows, error } = await userClient
    .from("onboarding_progress")
    .select("step");
  if (error) {
    return json({ error: error.message }, 400);
  }

  const done = new Set(rows.map((r) => r.step));
  const nextStep = REQUIRED_STEPS.find((s) => !done.has(s)) ?? null;

  return json({ nextStep }, 200);
}));

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

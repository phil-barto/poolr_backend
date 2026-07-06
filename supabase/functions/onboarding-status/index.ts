// onboarding-status — returns the caller's next incomplete onboarding step, or
// null when onboarding is done. The required-step list lives in
// _shared/onboarding.ts; the client routes to /onboarding/<step> blindly.

import { requireUser } from "../_shared/auth.ts";
import { json, serveFunction } from "../_shared/http.ts";
import { REQUIRED_STEPS } from "../_shared/onboarding.ts";

serveFunction(async (req) => {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const { userClient } = auth;

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
});

// onboarding-skip — records a permanent skip for a skippable onboarding step.
// The table has zero client write grants; this function is the controlled write
// path (same posture as plaid-exchange). Skips never overwrite completions.

import { requireUser, serviceClient } from "../_shared/auth.ts";
import { json, serveFunction } from "../_shared/http.ts";
import { SKIPPABLE_STEPS, type OnboardingStep } from "../_shared/onboarding.ts";

serveFunction(async (req) => {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const { step } = await req.json().catch(() => ({}));
  if (!SKIPPABLE_STEPS.includes(step)) {
    return json({ error: "Step is not skippable" }, 400);
  }
  const skippedStep: OnboardingStep = step;

  const adminClient = serviceClient();

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
});

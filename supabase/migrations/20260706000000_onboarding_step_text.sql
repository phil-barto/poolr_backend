-- Onboarding step vocabulary moves to code: supabase/functions/_shared/onboarding.ts
-- owns the ordered step list and skippable allowlist. A pg enum would force a
-- migration for every new step; the column becomes plain text (0 rows, free).
-- All writes go through server code that validates, so no check constraint.

alter table public.onboarding_progress
  alter column step type text using step::text;
drop type public.onboarding_step;

-- Distinguish "user skipped" from "user completed" so skip rows don't lie in
-- funnel queries. Routing only checks row existence; skipped is analytics truth.
alter table public.onboarding_progress
  add column skipped boolean not null default false;

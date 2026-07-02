-- Onboarding progress: which onboarding steps each user has completed. Modeled as a
-- table (one row per completed step) rather than a boolean on profiles, so new stages
-- can be added later without a profiles schema change — add a value to onboarding_step
-- and record it here. "Fully onboarded" is derived (all required steps present), not
-- stored, so the required set can change without a backfill.
--
-- Steps are written server-side only, by the SECURITY DEFINER / service-role function
-- that owns each step (e.g. plaid-exchange records 'bank_linked' after storing a bank
-- connection). Clients may READ their own progress to drive routing but never write it:
-- RLS grants select-own and there is no write policy, so writes are denied for the
-- authenticated role even under Supabase's default table grants. Service role bypasses
-- RLS.

create type public.onboarding_step as enum ('bank_linked');

create table public.onboarding_progress (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  step         public.onboarding_step not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, step)
);

alter table public.onboarding_progress enable row level security;

create policy "Owner reads own onboarding progress" on public.onboarding_progress
  for select to authenticated using (auth.uid() = user_id);

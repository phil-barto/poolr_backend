-- Test migration for Supabase CI/CD + RLS
-- Creates a simple notes table where users can only access their own rows.

create table if not exists public.cicd_test_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  created_at timestamptz not null default now()
);

comment on table public.cicd_test_notes is
  'Temporary table for testing Supabase migration CI/CD and RLS.';

-- Helpful index for owner-scoped queries.
create index if not exists cicd_test_notes_user_id_idx
  on public.cicd_test_notes(user_id);

-- Enable Row Level Security.
alter table public.cicd_test_notes enable row level security;

-- Optional but stricter: even table owners are subject to RLS unless they bypass it.
alter table public.cicd_test_notes force row level security;

-- Allow authenticated users to read only their own notes.
create policy "Users can read their own cicd test notes"
on public.cicd_test_notes
for select
to authenticated
using (
  auth.uid() = user_id
);

-- Allow authenticated users to insert only rows owned by themselves.
create policy "Users can insert their own cicd test notes"
on public.cicd_test_notes
for insert
to authenticated
with check (
  auth.uid() = user_id
);

-- Allow authenticated users to update only their own notes.
create policy "Users can update their own cicd test notes"
on public.cicd_test_notes
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

-- Allow authenticated users to delete only their own notes.
create policy "Users can delete their own cicd test notes"
on public.cicd_test_notes
for delete
to authenticated
using (
  auth.uid() = user_id
);
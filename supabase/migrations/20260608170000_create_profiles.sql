-- Profiles: one row per Poolr user, created automatically on signup.
--
-- Phone number is the user's identity (it lives on auth.users.phone). This table
-- holds the app-facing profile fields the rest of Poolr reads — display name,
-- avatar, and the Venmo handle used to pre-fill settlement payments.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  -- Mirror of auth.users.phone (E.164), copied on signup for easy joins/lookups
  -- such as matching pending trip invites by number.
  phone text,
  display_name text,
  avatar_url text,
  venmo_handle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'App-facing profile per user. Identity (phone) lives on auth.users.';

-- Create the profile row whenever a new auth user is inserted. SECURITY DEFINER so
-- the trigger can write regardless of the (anon/none) role doing the signup; the
-- empty search_path is the Supabase-recommended hardening for definer functions.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security: a user owns their own profile row.
-- Reading OTHER members' profiles (names/avatars/Venmo within a shared trip) will
-- be added alongside the trips/trip_members schema, as a policy that joins through
-- shared membership.
alter table public.profiles enable row level security;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

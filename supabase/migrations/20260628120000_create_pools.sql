-- Pools: a shared expense pool owned by one user.
--
-- API surface rule: the frontend NEVER queries this table directly. pg_graphql
-- only exposes a table when a role has been GRANTed on it, so we deliberately
-- grant NOTHING on public.pools to anon/authenticated. All access goes through the
-- SECURITY DEFINER functions below (list_pools / create_pool) — the only GraphQL
-- fields the client sees. RLS stays enabled as defense-in-depth in case a grant is
-- ever added by mistake.

-- updated_at helper (idempotent; shared by every table going forward).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.pools (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pools_owner_id_idx on public.pools(owner_id);

comment on table public.pools is
  'Expense pools. Not exposed to GraphQL directly (no grants); access via the '
  'list_pools / create_pool functions only.';

create trigger set_pools_updated_at
  before update on public.pools
  for each row execute function public.set_updated_at();

-- RLS: defense-in-depth. The table has no grants so the client cannot reach it,
-- but if a grant is ever added these policies still scope rows to the owner.
alter table public.pools enable row level security;

create policy "Owners can read their pools"
on public.pools for select to authenticated
using (auth.uid() = owner_id);

create policy "Owners can insert their pools"
on public.pools for insert to authenticated
with check (auth.uid() = owner_id);

create policy "Owners can update their pools"
on public.pools for update to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Owners can delete their pools"
on public.pools for delete to authenticated
using (auth.uid() = owner_id);

-- Explicitly keep the table off the GraphQL surface, even if a future blanket
-- grant is added elsewhere.
revoke all on public.pools from anon, authenticated;

-- ── API surface: functions only ──────────────────────────────────────────────
-- SECURITY DEFINER because the table grants are revoked: the definer (table owner)
-- can read/write, and authorization is enforced explicitly via auth.uid() below.
-- search_path is empty per Supabase hardening; reference everything fully-qualified.
-- pg_graphql exposes a STABLE function as a Query field and a VOLATILE one as a
-- Mutation field; a `setof <table>` return surfaces as a Relay connection.

create or replace function public.list_pools()
returns setof public.pools
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from public.pools
  where owner_id = auth.uid()
  order by created_at desc;
$$;

create or replace function public.create_pool(name text)
returns public.pools
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  new_pool public.pools;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.pools (owner_id, name)
  values (caller, name)
  returning * into new_pool;

  return new_pool;
end;
$$;

-- Lock function execution to signed-in users only.
revoke all on function public.list_pools() from public;
revoke all on function public.create_pool(text) from public;
grant execute on function public.list_pools() to authenticated;
grant execute on function public.create_pool(text) to authenticated;

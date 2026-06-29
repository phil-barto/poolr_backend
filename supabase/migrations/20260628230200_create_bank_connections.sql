-- bank_connections: one user -> many linked accounts (Plaid-style).
--
-- API surface rule (same as the rest of Poolr): the client never queries this table
-- directly. No grants are issued, so pg_graphql does not expose it; all access flows
-- through SECURITY DEFINER functions that ship with their features. access_token is
-- encrypted at the provider/app layer and never leaves the server.

create table public.bank_connections (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  provider     text not null,
  access_token text not null,
  status       public.bank_connection_status not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index bank_connections_user_id_idx on public.bank_connections(user_id);

-- public.set_updated_at() already exists (created with the pools migration).
create trigger set_bank_connections_updated_at before update on public.bank_connections
  for each row execute function public.set_updated_at();

-- RLS as defense-in-depth: no grants exist, so the policy only matters if a grant
-- is ever added by mistake.
alter table public.bank_connections enable row level security;

create policy "Owner reads own bank connections" on public.bank_connections
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.bank_connections from anon, authenticated;

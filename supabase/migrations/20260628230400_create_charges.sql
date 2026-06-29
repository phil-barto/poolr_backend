-- charges: raw bank-transaction candidates pulled per trip. Private to the owner,
-- pre-ledger (the swipe-screen inbox).
--
-- API surface rule: no grants; access via SECURITY DEFINER feature functions only.
--
-- Re-pulling the bank is safe: (bank_connection_id, external_tx_id) dedupes on
-- re-sync and never touches confirmed expenses. One charge -> at most one expense
-- (see expenses.charge_id in the ledger migration).
create table public.charges (
  id                 uuid primary key default gen_random_uuid(),
  trip_id            uuid not null references public.trips(id) on delete cascade,
  user_id            uuid not null references public.profiles(id) on delete cascade,
  bank_connection_id uuid not null references public.bank_connections(id) on delete cascade,
  external_tx_id     text not null,
  raw_name           text not null,
  clean_name         text,
  amount_cents       bigint not null check (amount_cents > 0),
  charged_at         date not null,
  category           text,
  review_status      public.charge_review_status not null default 'pending',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (bank_connection_id, external_tx_id)
);

create index charges_trip_review_idx on public.charges(trip_id, review_status);
create index charges_user_id_idx on public.charges(user_id);

create trigger set_charges_updated_at before update on public.charges
  for each row execute function public.set_updated_at();

-- RLS as defense-in-depth (no grants). Charges are private to their owner.
alter table public.charges enable row level security;

create policy "Owner reads own charges" on public.charges
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.charges from anon, authenticated;

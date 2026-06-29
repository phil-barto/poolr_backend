-- Ledger: settlements, expenses, expense_splits, settlement_payments.
--
-- API surface rule: no grants; access via SECURITY DEFINER feature functions only
-- (confirm_expense, add_manual_expense, edit/delete, trigger_settlement, get_balance)
-- which ship with their features. This migration is schema + defense-in-depth RLS.

-- ── settlements ───────────────────────────────────────────────────────────────
-- A point-in-time settlement of the current running balance. Created by anyone, any
-- time; the trip stays open afterward. Declared first because expenses FKs to it.
create table public.settlements (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  triggered_by uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index settlements_trip_id_idx on public.settlements(trip_id);

-- ── expenses ──────────────────────────────────────────────────────────────────
-- Confirmed ledger entry, group-visible. Origin is either a swiped-right charge
-- (charge_id set) or a manual cash/unposted entry (charge_id null). settlement_id is
-- the soft cutoff: null = part of the current running balance; set = locked into a
-- past settlement. Only the submitter may edit/delete (enforced in the functions).
create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  submitter_id  uuid not null references public.profiles(id) on delete cascade,
  charge_id     uuid unique references public.charges(id) on delete set null,
  settlement_id uuid references public.settlements(id) on delete set null,
  name          text not null check (length(trim(name)) > 0),
  amount_cents  bigint not null check (amount_cents > 0),
  spent_at      date not null,
  category      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index expenses_trip_settlement_idx on public.expenses(trip_id, settlement_id);
create index expenses_submitter_id_idx on public.expenses(submitter_id);

-- ── expense_splits ────────────────────────────────────────────────────────────
-- Per-person allocation of an expense. Even by default; is_locked marks a share the
-- user set by hand so redistribution leaves it alone. Percentage is derived
-- (amount_cents / expense total) and intentionally NOT stored.
create table public.expense_splits (
  id           uuid primary key default gen_random_uuid(),
  expense_id   uuid not null references public.expenses(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),
  is_locked    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (expense_id, user_id)
);

create index expense_splits_expense_id_idx on public.expense_splits(expense_id);
create index expense_splits_user_id_idx on public.expense_splits(user_id);

-- ── settlement_payments ───────────────────────────────────────────────────────
-- Netted, minimized debtor -> creditor transfers produced when a settlement runs.
-- These pre-fill the Venmo handoff; status flips to 'paid' when confirmed.
create table public.settlement_payments (
  id            uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  from_user_id  uuid not null references public.profiles(id) on delete cascade,
  to_user_id    uuid not null references public.profiles(id) on delete cascade,
  amount_cents  bigint not null check (amount_cents > 0),
  status        public.payment_status not null default 'pending',
  paid_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create index settlement_payments_settlement_id_idx on public.settlement_payments(settlement_id);
create index settlement_payments_from_user_idx on public.settlement_payments(from_user_id);
create index settlement_payments_to_user_idx on public.settlement_payments(to_user_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────
create trigger set_expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
create trigger set_expense_splits_updated_at before update on public.expense_splits
  for each row execute function public.set_updated_at();
create trigger set_settlement_payments_updated_at before update on public.settlement_payments
  for each row execute function public.set_updated_at();

-- ── RLS: defense-in-depth ─────────────────────────────────────────────────────
-- No grants issued; policies scope reads to trip membership via is_trip_member().
alter table public.settlements         enable row level security;
alter table public.expenses            enable row level security;
alter table public.expense_splits      enable row level security;
alter table public.settlement_payments enable row level security;

create policy "Members read trip settlements" on public.settlements
  for select to authenticated using (public.is_trip_member(trip_id));

create policy "Members read trip expenses" on public.expenses
  for select to authenticated using (public.is_trip_member(trip_id));

create policy "Members read splits in their trips" on public.expense_splits
  for select to authenticated using (
    public.is_trip_member((select e.trip_id from public.expenses e where e.id = expense_id))
  );

create policy "Members read settlement payments" on public.settlement_payments
  for select to authenticated using (
    public.is_trip_member((select s.trip_id from public.settlements s where s.id = settlement_id))
  );

revoke all on public.settlements         from anon, authenticated;
revoke all on public.expenses            from anon, authenticated;
revoke all on public.expense_splits      from anon, authenticated;
revoke all on public.settlement_payments from anon, authenticated;

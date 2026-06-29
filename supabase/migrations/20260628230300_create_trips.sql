-- trips + trip_members: a trip and its roster.
--
-- API surface rule: no grants; clients reach trips only via the functions at the
-- bottom (list_trips / create_trip). Remaining feature functions (invite_member,
-- etc.) ship with their features.
--
-- Identity note: user FKs reference public.profiles(id) (== auth.users.id). There is
-- no separate users table.

-- end_date is the upper bound of the charge-matching window. Both dates nullable so
-- a trip can be created before plans firm up.
create table public.trips (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  start_date date,
  end_date   date,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index trips_created_by_idx on public.trips(created_by);

-- Membership + invite state. An invite can exist before the invitee has an account:
-- invited_phone holds the number, user_id stays null until they sign up and claim
-- the invite via invite_token (carried by the SMS deep-link).
create table public.trip_members (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete cascade,
  invited_phone text not null,
  status        public.member_status not null default 'pending',
  invite_token  text not null unique,
  joined_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (trip_id, invited_phone)
);

create index trip_members_trip_id_idx on public.trip_members(trip_id);
create index trip_members_user_id_idx on public.trip_members(user_id);
create index trip_members_invite_token_idx on public.trip_members(invite_token);
create index trip_members_invited_phone_idx on public.trip_members(invited_phone);

create trigger set_trips_updated_at before update on public.trips
  for each row execute function public.set_updated_at();
create trigger set_trip_members_updated_at before update on public.trip_members
  for each row execute function public.set_updated_at();

-- Membership helper: true if the caller is a joined member of the trip. SECURITY
-- DEFINER + empty search_path so it reads trip_members regardless of grants. Used by
-- RLS policies (here and in the charges/ledger migrations) and feature functions.
create or replace function public.is_trip_member(trip uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members m
    where m.trip_id = trip
      and m.user_id = auth.uid()
      and m.status = 'joined'
  );
$$;

-- RLS as defense-in-depth (no grants issued).
alter table public.trips        enable row level security;
alter table public.trip_members enable row level security;

create policy "Members read their trips" on public.trips
  for select to authenticated using (public.is_trip_member(id));

create policy "Members read trip roster" on public.trip_members
  for select to authenticated using (public.is_trip_member(trip_id));

revoke all on public.trips        from anon, authenticated;
revoke all on public.trip_members from anon, authenticated;

-- ── API surface ───────────────────────────────────────────────────────────────
-- Trips the caller belongs to, newest first.
create or replace function public.list_trips()
returns setof public.trips
language sql
stable
security definer
set search_path = ''
as $$
  select t.*
  from public.trips t
  join public.trip_members m on m.trip_id = t.id
  where m.user_id = auth.uid()
    and m.status = 'joined'
  order by t.created_at desc;
$$;

-- Create a trip and add the creator as the first joined member.
create or replace function public.create_trip(name text, start_date date default null, end_date date default null)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  new_trip public.trips;
  caller_phone text;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.trips (name, start_date, end_date, created_by)
  values (name, start_date, end_date, caller)
  returning * into new_trip;

  select p.phone into caller_phone from public.profiles p where p.id = caller;

  insert into public.trip_members (trip_id, user_id, invited_phone, status, invite_token, joined_at)
  values (new_trip.id, caller, coalesce(caller_phone, ''), 'joined', gen_random_uuid()::text, now());

  return new_trip;
end;
$$;

revoke all on function public.list_trips() from public;
revoke all on function public.create_trip(text, date, date) from public;
grant execute on function public.list_trips() to authenticated;
grant execute on function public.create_trip(text, date, date) to authenticated;

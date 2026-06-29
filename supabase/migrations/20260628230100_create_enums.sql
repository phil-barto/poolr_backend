-- Status columns across the Poolr schema use enums (not free text) so a typo like
-- 'splited' fails loudly at write time instead of silently corrupting state.
create type public.bank_connection_status as enum ('active', 'error', 'disconnected');
create type public.member_status          as enum ('pending', 'joined');
create type public.charge_review_status   as enum ('pending', 'skipped', 'split');
create type public.payment_status         as enum ('pending', 'paid');

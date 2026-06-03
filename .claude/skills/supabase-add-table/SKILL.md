---
name: supabase-add-table
description: Add a new Postgres table to the Poolr Supabase backend with RLS, grants, and GraphQL exposure. Use when creating any new table or entity.
---

# Add a table (secure by default)

`auto_expose_new_tables = false`, so a new table is invisible to the API until you GRANT. Never skip RLS.

In a new migration `supabase/migrations/NNNN_<name>.sql`:

1. **Create** the table. Add `created_at`/`updated_at timestamptz default now()`.
2. **Enable RLS**: `alter table public.<t> enable row level security;`
3. **Policies** — deny by default; scope to `auth.uid()`. Separate policies per action (select/insert/update/delete). For membership checks across tables, use a `security definer` helper (see `is_pool_member` in `0001_init.sql`) to avoid RLS recursion.
4. **updated_at trigger**: `create trigger ... before update ... execute function public.set_updated_at();`
5. **Grant**: `grant select, insert, update, delete on public.<t> to authenticated;` (required because of `auto_expose_new_tables = false`).

Then `supabase db reset` (local) and verify policies. pg_graphql exposes the table automatically once granted; query it as `<table>Collection` (Relay style).

Rule: authorization lives in RLS, never in the client.

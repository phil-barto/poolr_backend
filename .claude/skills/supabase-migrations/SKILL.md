---
name: supabase-migrations
description: Data modeling conventions and how to author, run, and ship a migration in the Poolr Supabase backend. Use when designing a schema, changing the database, or adding a migration file.
---

# Data modeling & migrations

Migrations are the single source of truth. Never edit prod schema in Studio — every change is a migration in `supabase/migrations/`, reviewed in a PR.

## Authoring a migration

1. create migrations with supabase migration new (migration name)
2. Write **forward-only, idempotent-friendly** SQL. Prefer `create ... if not exists` / `create or replace` where safe.
3. Apply locally and verify: `supabase db reset` (rebuilds from all migrations + `seed.sql`).
4. Diff against the remote before shipping: `supabase db push` (runs in CI on merge; test against staging first).
5. Always use RLS policies on these tables

Migrations are forward-only in practice — to undo, write a new migration. Don't rewrite a migration that's already been pushed.

## Data modeling conventions

- **Keys**: `uuid primary key default gen_random_uuid()`. Anchor user-owned rows to `auth.users(id)` via `public.profiles(id)`.
- **Timestamps**: every table gets `created_at` and `updated_at timestamptz not null default now()`, plus the `set_updated_at` trigger.
- **Constraints over app checks**: `not null`, `check`, `unique`, and FK `on delete cascade` belong in the schema. Fail fast at the DB.
- **Index foreign keys** and any column you filter/sort on in RLS or queries.
- **Normalize** by default; introduce a view for denormalized read shapes rather than duplicating columns.
- **Naming**: `snake_case`, plural tables (`pools`), singular columns, `<table>_<col>_idx` indexes.
- **Ownership/membership**: model with an explicit join table (see `pool_members`) and gate access via a `security definer` helper to avoid RLS recursion.

## After the schema lands

- Enable RLS + grants → see [[supabase-add-table]].
- Expose writes as functions → see [[supabase-add-rpc]].
- Update frontend operations (`graphql/operations/`) + run `npm run codegen` → see [[graphql-codegen]].

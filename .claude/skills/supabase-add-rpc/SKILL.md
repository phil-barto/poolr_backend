---
name: supabase-add-rpc
description: Add a Postgres function exposed as a GraphQL mutation in the Poolr backend. Use for atomic writes or multi-step domain logic that should be one transaction.
---

# Add an RPC (GraphQL mutation)

Route writes through functions, not raw GraphQL mutations: one transactional, testable, named operation.

In `supabase/migrations/NNNN_<name>.sql`:

```sql
create or replace function public.<name>(<args>)
returns <type>                 -- a table type (e.g. public.pools) for typed GraphQL output
language plpgsql
security invoker               -- runs as caller, so RLS applies. Use definer ONLY for vetted privileged ops.
set search_path = ''           -- always; reference objects fully-qualified (public.x)
as $$ ... $$;

grant execute on function public.<name>(<args>) to authenticated;
```

- `security invoker` is the default choice — RLS still protects rows.
- pg_graphql exposes it as a mutation field named after the function (camelCased).
- For privileged work that must bypass RLS or call external APIs, use an Edge Function instead (see `supabase-edge-function`).

Add the matching operation in the frontend's `graphql/operations/` and run `npm run codegen`.

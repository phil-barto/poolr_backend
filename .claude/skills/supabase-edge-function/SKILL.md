---
name: supabase-edge-function
description: Add a Supabase Edge Function (Deno) to the Poolr backend for privileged or external-API logic. Use when work bypasses RLS, calls third-party APIs, or spans multiple steps beyond a single SQL transaction.
---

# Add an Edge Function

Use for privileged / external work that does NOT belong in RLS or an RPC: receipt validation, payments, push, webhooks, anything needing the service-role key.

Create `supabase/functions/<name>/index.ts`. The required pattern:

1. Handle `OPTIONS` with shared CORS (`../_shared/cors.ts`).
2. Read `Authorization` header → create a **user-scoped** client (anon key + forwarded header) → `auth.getUser()` to verify the caller.
3. Apply business rules / validate input.
4. Only then create a **service-role** client (`SUPABASE_SERVICE_ROLE_KEY`) for the privileged write. This key bypasses RLS and must never reach the client.

Copy `supabase/functions/redeem-invite/index.ts` as the template.

Deploy: `supabase functions deploy <name>`. Set secrets with `supabase secrets set KEY=...`.

Call from iOS via `SupabaseService.shared.client.functions.invoke(...)` (not Apollo).

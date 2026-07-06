# poolr_backend

Supabase backend for Poolr: Postgres migrations (`supabase/migrations/`) and
Deno edge functions (`supabase/functions/`). The client app lives in
`poolr_frontend` and talks to this via pg_graphql and `functions.invoke`.

## Local development

```sh
supabase start            # local stack (Postgres, auth, functions) with migrations applied
supabase functions serve  # run edge functions locally (reads supabase/functions/.env)
deno check --node-modules-dir=none supabase/functions/*/index.ts   # typecheck functions
```

Local auth uses a test OTP (see `supabase/config.toml`): phone `15555550100`,
code `123456` — no real SMS is sent.

## Deploying

Push to `main` — CI/CD applies migrations and deploys edge functions. Do NOT
deploy manually (`supabase db push`, `supabase functions deploy`).

## Secrets

- Local: `supabase/functions/.env` (gitignored) — Plaid sandbox keys, Sentry DSN.
- Hosted: managed in the Supabase dashboard (Edge Functions → Secrets).

## Conventions

- Migrations: `<UTC timestamp>_<verb>_<subject>.sql`, applied in timestamp order.
  Never edit an applied migration; add a new one.
- Edge functions: business logic only — CORS preflight, Sentry, and caller
  verification come from `_shared/http.ts` (`serveFunction`, `json`) and
  `_shared/auth.ts` (`requireUser`, `serviceClient`). See
  `redeem-invite/index.ts` for the privileged-write pattern.
- Domain vocabulary (e.g. onboarding steps) lives in TS (`_shared/*.ts`), not
  in Postgres enums.

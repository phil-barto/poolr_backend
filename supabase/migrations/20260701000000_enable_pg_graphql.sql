-- pg_graphql is our entire transport layer (config.toml exposes graphql_public).
-- Supabase normally pre-installs it, but a local DB lost it. Ensure it exists so
-- resets and fresh clones always have it. No-op on hosted (already installed).
create extension if not exists pg_graphql with schema graphql;

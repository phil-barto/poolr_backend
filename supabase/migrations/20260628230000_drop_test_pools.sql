-- pools was a CI/CD scaffolding table, not real schema. Drop it. CASCADE also
-- removes list_pools/create_pool, which return/insert the pools rowtype.
drop table if exists public.pools cascade;

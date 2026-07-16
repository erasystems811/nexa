-- Full-text search for listings.
--
-- Search used `ilike('title', '%word%')`. A leading wildcard can never use a
-- normal index, so that query is a full scan of every listing on every
-- keystroke — fine at a few hundred rows, a real outage risk once there are
-- thousands, and the first thing that breaks on the way to millions.
--
-- A generated tsvector column + GIN index is the standard Postgres answer:
-- indexed, ranked, and it matches "chairs" against "chair rental" the way a
-- customer expects, not just an exact substring.

alter table public.listings
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;

create index if not exists listings_search_vector_idx
  on public.listings using gin (search_vector);

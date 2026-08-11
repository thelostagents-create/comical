-- Stores the year a series/volume started, so search results and series
-- pages can show it (e.g. distinguishing a 2011 "Batman" run from a 2016
-- one). Nullable/free-text since older or hand-imported series may not
-- have one on record.
alter table public.series
  add column start_year text;

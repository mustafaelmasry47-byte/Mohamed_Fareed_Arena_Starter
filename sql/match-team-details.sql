-- Add two independent free-text detail fields to each match.
alter table public.matches
  add column if not exists home_details text,
  add column if not exists away_details text;

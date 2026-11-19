-- Archive finished match data and player statistics before a match is deleted.
-- This keeps season standings and player history intact when weekly fixtures are replaced.

create table if not exists public.archived_matches (
  original_match_id bigint primary key,
  match_data jsonb not null,
  archived_at timestamptz not null default now()
);

create table if not exists public.archived_match_stats (
  original_match_id bigint not null,
  player_id bigint not null,
  stats_data jsonb not null,
  archived_at timestamptz not null default now(),
  primary key (original_match_id, player_id)
);

alter table public.archived_matches enable row level security;
alter table public.archived_match_stats enable row level security;

drop policy if exists "Public can read archived matches" on public.archived_matches;
create policy "Public can read archived matches"
on public.archived_matches for select to anon, authenticated using (true);

drop policy if exists "Public can read archived match stats" on public.archived_match_stats;
create policy "Public can read archived match stats"
on public.archived_match_stats for select to anon, authenticated using (true);

create or replace function public.archive_match_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.archived_matches (original_match_id, match_data)
  values (old.id, to_jsonb(old))
  on conflict (original_match_id) do update
    set match_data = excluded.match_data, archived_at = now();

  insert into public.archived_match_stats (original_match_id, player_id, stats_data)
  select old.id, pms.player_id, to_jsonb(pms)
  from public.player_match_stats pms
  where pms.match_id = old.id
  on conflict (original_match_id, player_id) do update
    set stats_data = excluded.stats_data, archived_at = now();

  return old;
end;
$$;

drop trigger if exists archive_match_before_delete_trigger on public.matches;
create trigger archive_match_before_delete_trigger
before delete on public.matches
for each row execute function public.archive_match_before_delete();

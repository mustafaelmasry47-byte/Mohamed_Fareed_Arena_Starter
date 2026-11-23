-- RESET TOURNAMENT RESULTS ONLY
-- Keeps teams, players, admin accounts, photos, and team/player details.
-- Removes all current fixtures and match statistics, plus saved tournament
-- leaderboards/awards and archived match history.
-- Run once in Supabase SQL Editor after reviewing the statements.

begin;

-- Deleting matches also cascades to player_match_stats. If the archive trigger
-- is installed, it may copy the deleted rows into the archive tables first.
delete from public.matches;

-- Remove any archived copies so the new tournament starts completely clean.
do $$
begin
  if to_regclass('public.archived_match_stats') is not null then
    execute 'delete from public.archived_match_stats';
  end if;
  if to_regclass('public.archived_matches') is not null then
    execute 'delete from public.archived_matches';
  end if;
  if to_regclass('public.weekly_awards') is not null then
    execute 'delete from public.weekly_awards';
  end if;
  if to_regclass('public.leader_overrides') is not null then
    execute 'delete from public.leader_overrides';
  end if;
  if to_regclass('public.tournament_awards') is not null then
    execute $q$
      update public.tournament_awards
      set week_start = null,
          week_end = null,
          weekly_cleared = true,
          monthly_player_id = null,
          award_month = null,
          updated_at = now()
    $q$;
  end if;
end
$$;

commit;

-- Expected result: teams and players remain; matches, match stats,
-- archived match data, manual leaderboard overrides, and award history are empty.

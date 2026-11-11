-- MFA: safe additive setup for player photo uploads and a 15-player team limit.
-- Run this file ONCE in Supabase SQL Editor. It does not delete or rewrite existing rows.

-- Create/update the public image bucket used by the admin upload control.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-photos', 'player-photos', true, 4194304, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public visitors can display uploaded player photos; only the tournament admin can change them.
drop policy if exists "Public can view player photos" on storage.objects;
create policy "Public can view player photos" on storage.objects
for select to anon, authenticated using (bucket_id = 'player-photos');

drop policy if exists "Tournament admin can upload player photos" on storage.objects;
create policy "Tournament admin can upload player photos" on storage.objects
for insert to authenticated
with check (bucket_id = 'player-photos' and public.is_tournament_admin());

drop policy if exists "Tournament admin can update player photos" on storage.objects;
create policy "Tournament admin can update player photos" on storage.objects
for update to authenticated
using (bucket_id = 'player-photos' and public.is_tournament_admin())
with check (bucket_id = 'player-photos' and public.is_tournament_admin());

drop policy if exists "Tournament admin can delete player photos" on storage.objects;
create policy "Tournament admin can delete player photos" on storage.objects
for delete to authenticated
using (bucket_id = 'player-photos' and public.is_tournament_admin());

-- Enforce the 15-player limit at database level as well as in the admin interface.
create or replace function public.enforce_team_player_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.team_id is not null and (
    select count(*) from public.players p
    where p.team_id = new.team_id and p.id <> coalesce(new.id, -1)
  ) >= 15 then
    raise exception 'TEAM_PLAYER_LIMIT: each team can have at most 15 players';
  end if;
  return new;
end;
$$;

drop trigger if exists players_max_15_per_team on public.players;
create trigger players_max_15_per_team
before insert or update of team_id on public.players
for each row execute function public.enforce_team_player_limit();

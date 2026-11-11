create table if not exists public.leader_overrides (
 player_id bigint primary key references public.players(id) on delete cascade,
 goals_override integer check (goals_override is null or goals_override >= 0),
 assists_override integer check (assists_override is null or assists_override >= 0),
 rating_override numeric(3,1) check (rating_override is null or (rating_override >= 0 and rating_override <= 10)),
 updated_at timestamptz not null default now()
);
alter table public.leader_overrides enable row level security;
drop policy if exists "Public can read leader overrides" on public.leader_overrides;
create policy "Public can read leader overrides" on public.leader_overrides for select to anon, authenticated using (true);
drop policy if exists "Admins manage leader overrides" on public.leader_overrides;
create policy "Admins manage leader overrides" on public.leader_overrides for all to authenticated using (public.is_tournament_admin()) with check (public.is_tournament_admin());

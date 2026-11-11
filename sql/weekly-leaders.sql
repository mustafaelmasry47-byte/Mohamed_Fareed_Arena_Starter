-- Weekly leaders and manually selected player of the month
create table if not exists public.tournament_awards (
  id integer primary key default 1 check (id = 1),
  week_start date,
  week_end date,
  weekly_cleared boolean not null default true,
  monthly_player_id bigint references public.players(id) on delete set null,
  award_month date,
  updated_at timestamptz not null default now(),
  constraint valid_week_range check (week_start is null or week_end is null or week_start <= week_end)
);
alter table public.tournament_awards enable row level security;
drop policy if exists "public read tournament awards" on public.tournament_awards;
create policy "public read tournament awards" on public.tournament_awards
for select to anon, authenticated using (true);
drop policy if exists "admin manage tournament awards" on public.tournament_awards;
create policy "admin manage tournament awards" on public.tournament_awards
for all to authenticated using (public.is_tournament_admin())
with check (public.is_tournament_admin());
insert into public.tournament_awards (id, weekly_cleared)
values (1, true) on conflict (id) do nothing;

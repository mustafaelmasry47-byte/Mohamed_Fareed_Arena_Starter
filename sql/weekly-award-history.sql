-- Manual weekly winner history: one winner per numbered week.
create table if not exists public.weekly_awards (
  week_number integer primary key check (week_number between 1 and 30),
  player_id bigint not null references public.players(id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.weekly_awards enable row level security;
drop policy if exists "public read weekly awards" on public.weekly_awards;
create policy "public read weekly awards" on public.weekly_awards
for select to anon, authenticated using (true);
drop policy if exists "admin manage weekly awards" on public.weekly_awards;
create policy "admin manage weekly awards" on public.weekly_awards
for all to authenticated using (public.is_tournament_admin())
with check (public.is_tournament_admin());

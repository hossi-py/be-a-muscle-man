create table if not exists public.workout_entries (
  id uuid primary key,
  profile_id text not null default 'default',
  entry_date date not null,
  exercise text not null,
  sets jsonb not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists workout_entries_profile_date_idx
  on public.workout_entries (profile_id, entry_date desc, created_at desc);

create table if not exists public.protein_entries (
  profile_id text not null default 'default',
  entry_date date not null,
  grams numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (profile_id, entry_date)
);

alter table public.workout_entries enable row level security;
alter table public.protein_entries enable row level security;

drop policy if exists "Allow anon workout reads" on public.workout_entries;
drop policy if exists "Allow anon workout inserts" on public.workout_entries;
drop policy if exists "Allow anon workout deletes" on public.workout_entries;
drop policy if exists "Allow anon protein reads" on public.protein_entries;
drop policy if exists "Allow anon protein inserts" on public.protein_entries;
drop policy if exists "Allow anon protein updates" on public.protein_entries;

create policy "Allow anon workout reads"
  on public.workout_entries
  for select
  to anon
  using (true);

create policy "Allow anon workout inserts"
  on public.workout_entries
  for insert
  to anon
  with check (true);

create policy "Allow anon workout deletes"
  on public.workout_entries
  for delete
  to anon
  using (true);

create policy "Allow anon protein reads"
  on public.protein_entries
  for select
  to anon
  using (true);

create policy "Allow anon protein inserts"
  on public.protein_entries
  for insert
  to anon
  with check (true);

create policy "Allow anon protein updates"
  on public.protein_entries
  for update
  to anon
  using (true)
  with check (true);
